/**
 * The finish apply (step 3) and the fire-and-forget
 * summary upsert. Called from the DO post-commit — never under the
 * input gate.
 *
 * Rating deltas are computed HERE, not in the DO: they depend on global
 * cross-game priors, and any prior snapshotted into the DO is stale by
 * construction (games can run for days). The whole apply — summary row,
 * rating CAS, history log, and the `finish_id` marker — is ONE `batch()`
 * transaction, so the dedupe marker and the effects it guards can never
 * disagree.
 *
 * The CAS: each history INSERT is stamped with the `player_ratings.revision`
 * its delta was computed against, and `idx_rating_history_{user,bot}_cas`
 * makes (identity, pool, revision_before) unique. A concurrent finish that
 * read the same revision therefore collides on that index, its batch rolls
 * back, and we re-read fresh priors and recompute. Within one committed
 * batch there is no concurrent writer, so a history row that landed
 * guarantees its paired rating write did too.
 */

import { computeRatings, defaultRating, displayRating, GameBugError, type GameStatus, type RatingDelta, type Seat } from "@eigen/kernel";
import type { GameAccess, JsonObject, OutcomeEntry } from "@eigen/rules";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { games, participants, playerRatings, ratingHistory, users } from "./schema.js";

export interface FinishApplyInput {
  gameId: string;
  /** The DO-minted idempotency key — the apply is a no-op replay when
   * the games row already carries it. */
  finishId: string;
  outcomes: OutcomeEntry[];
  roster: Seat[];
  rated: boolean;
  ratingPool: string | null;
  now: number;
}

const CAS_ATTEMPTS = 5;

/** Apply one finished game to D1. Returns the rated deltas (null for an
 * unrated game) for the DO to deliver as the ratings transition. Throws on
 * failure — the caller logs and keeps the outbox row (single attempt at
 * the call site; the internal loop only absorbs CAS conflicts). */
export async function applyFinish(d1: D1Database, input: FinishApplyInput): Promise<RatingDelta[] | null> {
  const db = drizzle(d1);
  /** Non-null exactly when this finish is rated — the sole rated/pool gate. */
  const pool = input.rated ? input.ratingPool : null;

  for (let attempt = 1; attempt <= CAS_ATTEMPTS; attempt++) {
    const game = await db.select({ finishId: games.finishId }).from(games).where(eq(games.id, input.gameId)).get();
    if (!game) throw new GameBugError(`No games row for ${input.gameId} at finish apply`);
    if (game.finishId === input.finishId) return pool !== null ? await recoverDeltas(d1, input.finishId) : null;
    if (game.finishId !== null) {
      throw new GameBugError(`Game ${input.gameId} already finished under ${game.finishId}`);
    }

    const summaryUpdate = db
      .update(games)
      .set({
        status: "finished",
        outcomes: input.outcomes,
        finishId: input.finishId,
        finishedAt: input.now,
        pendingPlayers: [],
        turnDeadline: null,
        updatedAt: input.now,
      })
      .where(and(eq(games.id, input.gameId), sql`${games.finishId} IS NULL`));

    if (pool === null) {
      await summaryUpdate;
      return null;
    }

    const priors = await readPriors(d1, pool, input.roster);
    const players = input.outcomes.map((entry) => {
      const seat = input.roster.find((s) => s.player_index === entry.player_index);
      if (!seat) throw new GameBugError(`Outcome for unknown seat ${entry.player_index}`);
      const prior = priors.get(identityKey(seat.user_id, seat.bot_id)) ?? { ...defaultRating(), revision: 0 };
      return {
        player_index: entry.player_index,
        user_id: seat.user_id,
        bot_id: seat.bot_id,
        mu: prior.mu,
        sigma: prior.sigma,
        placement: entry.placement,
        team_index: entry.team_index,
      };
    });

    const results = computeRatings(players);
    const allDeltas: RatingDelta[] = results.map((r) => {
      const key = identityKey(r.identity.user_id, r.identity.bot_id);
      const prior = priors.get(key) ?? { ...defaultRating(), revision: 0 };
      return {
        identity: r.identity,
        pool,
        mu_before: prior.mu,
        sigma_before: prior.sigma,
        display_before: displayRating(prior.mu, prior.sigma),
        mu_after: r.mu,
        sigma_after: r.sigma,
        display_after: displayRating(r.mu, r.sigma),
        display_change: displayRating(r.mu, r.sigma) - displayRating(prior.mu, prior.sigma),
      };
    });

    // Purge guard: a seat whose account was deleted since this game
    // began still carries its user_id in the DO roster (the purge nulls only
    // the D1 mirror, never wakes the DO), so it survives into `players` and
    // shapes the OpenSkill field — but it must NOT get a rating row, or the
    // purge would resurrect a player_ratings entry for a non-existent user.
    // Skip the write (and the returned delta) for any user identity no longer
    // in `users`; bots are never purged. Mirrors the old
    // `apply_rating_updates` existence guard. Recovery agrees by construction:
    // `recoverDeltas` reads history rows, which likewise lack the skipped seat.
    const deltaUserIds = allDeltas.flatMap((d) => (d.identity.user_id !== null ? [d.identity.user_id] : []));
    const existingUsers = await readExistingUsers(d1, deltaUserIds);
    const deltas = allDeltas.filter((d) => d.identity.user_id === null || existingUsers.has(d.identity.user_id));

    const statements = [summaryUpdate, ...ratingStatements(db, input, pool, deltas, priors)];
    try {
      await db.batch(statements as [typeof summaryUpdate, ...typeof statements]);
      return deltas;
    } catch (error) {
      // Only a CAS conflict is retryable, and it is the ONLY error this batch
      // is expected to produce: a concurrent finish collided on
      // idx_rating_history_*_cas. Anything else (a schema mistake, a D1
      // outage) is deterministic or needs a different remedy, and retrying it
      // four more times just delays the report — so it propagates now.
      if (!isUniqueViolation(error) || attempt === CAS_ATTEMPTS) throw error;
    }
  }
  throw new GameBugError("unreachable: CAS loop exit");
}

/** A SQLite UNIQUE-index rejection.
 *
 * Matched on text because neither D1 nor drizzle exposes a structured error
 * code — and matched down the `cause` chain because drizzle rethrows with its
 * own "Failed query: ..." message, which does NOT contain the constraint
 * text. Testing only the top-level message silently classifies every CAS
 * conflict as fatal, disabling the retry this function exists to enable
 * (`ratings-cas.spec.ts` covers it). The real chain is:
 *
 *   Error: Failed query: insert into "rating_history" ...
 *     └─ Error: D1_ERROR: UNIQUE constraint failed: rating_history.user_id, ...
 *          └─ Error: UNIQUE constraint failed: rating_history.user_id, ...
 */
export function isUniqueViolation(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e instanceof Error && depth < 5; e = e.cause, depth++) {
    if (/UNIQUE constraint failed/i.test(e.message)) return true;
  }
  return false;
}

interface PriorRow {
  mu: number;
  sigma: number;
  /** The row's CAS counter. Absent from the map ⇒ no player_ratings row yet,
   * which the apply reads as revision 0. */
  revision: number;
}

function identityKey(userId: string | null, botId: string | null): string {
  return userId !== null ? `u:${userId}` : `b:${botId}`;
}

/** Which of these user ids still exist — the purge guard's read (see the
 * call site). Empty in ⇒ empty out, no round trip. */
async function readExistingUsers(d1: D1Database, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await drizzle(d1).select({ id: users.id }).from(users).where(inArray(users.id, userIds)).all();
  return new Set(rows.map((r) => r.id));
}

/** One round trip for the whole roster (this runs inside the CAS loop):
 * every identified seat's rating row in the pool, keyed for the recompute. */
async function readPriors(d1: D1Database, pool: string, roster: Seat[]): Promise<Map<string, PriorRow>> {
  const priors = new Map<string, PriorRow>();
  const userIds = roster.flatMap((s) => (s.user_id !== null ? [s.user_id] : []));
  const botIds = roster.flatMap((s) => (s.user_id === null && s.bot_id !== null ? [s.bot_id] : []));
  const identities = [...(userIds.length > 0 ? [inArray(playerRatings.userId, userIds)] : []), ...(botIds.length > 0 ? [inArray(playerRatings.botId, botIds)] : [])];
  if (identities.length === 0) return priors; // every seat purged: defaults
  const rows = await drizzle(d1)
    .select({ userId: playerRatings.userId, botId: playerRatings.botId, mu: playerRatings.mu, sigma: playerRatings.sigma, revision: playerRatings.revision })
    .from(playerRatings)
    .where(and(eq(playerRatings.pool, pool), or(...identities)))
    .all();
  for (const row of rows) {
    priors.set(identityKey(row.userId, row.botId), { mu: row.mu, sigma: row.sigma, revision: row.revision });
  }
  return priors;
}

/** Per identity: the history INSERT — stamped with the revision this delta
 * was computed against, which is the CAS (see the module docstring) — then
 * the paired rating write. A never-rated identity has `revision_before = 0`
 * and gets an INSERT; everyone else gets an UPDATE to `revision_before + 1`.
 *
 * Both paths are guarded by the same index, so a first-time identity racing
 * another first-time write and an established identity racing a concurrent
 * finish fail identically and take the same retry. */
function ratingStatements(db: ReturnType<typeof drizzle>, input: FinishApplyInput, pool: string, deltas: RatingDelta[], priors: Map<string, PriorRow>) {
  const statements = [];
  for (const delta of deltas) {
    const { user_id: userId, bot_id: botId } = delta.identity;
    const revisionBefore = priors.get(identityKey(userId, botId))?.revision ?? 0;

    statements.push(
      db.insert(ratingHistory).values({
        id: crypto.randomUUID(),
        userId,
        botId,
        gameId: input.gameId,
        pool,
        finishId: input.finishId,
        revisionBefore,
        muBefore: delta.mu_before,
        sigmaBefore: delta.sigma_before,
        displayBefore: delta.display_before,
        muAfter: delta.mu_after,
        sigmaAfter: delta.sigma_after,
        displayAfter: delta.display_after,
        displayChange: delta.display_change,
        createdAt: input.now,
      }),
    );

    if (revisionBefore === 0) {
      statements.push(
        db.insert(playerRatings).values({
          id: crypto.randomUUID(),
          userId,
          botId,
          pool,
          mu: delta.mu_after,
          sigma: delta.sigma_after,
          displayRating: delta.display_after,
          revision: 1,
          createdAt: input.now,
          updatedAt: input.now,
        }),
      );
    } else {
      const identityWhere = userId !== null ? and(eq(playerRatings.userId, userId), eq(playerRatings.pool, pool)) : and(eq(playerRatings.botId, botId as string), eq(playerRatings.pool, pool));
      statements.push(
        db
          .update(playerRatings)
          .set({
            mu: delta.mu_after,
            sigma: delta.sigma_after,
            displayRating: delta.display_after,
            revision: revisionBefore + 1,
            updatedAt: input.now,
          })
          // Redundant given the history index above — a silent no-op here
          // is unreachable once that INSERT committed. Kept as a cheap
          // assertion, not as the guard.
          .where(and(identityWhere, eq(playerRatings.revision, revisionBefore))),
      );
    }
  }
  return statements;
}

/** A crashed-then-re-poked apply already landed: rebuild the deltas the DO
 * still needs (for the ratings transition) from the history rows. */
async function recoverDeltas(d1: D1Database, finishId: string): Promise<RatingDelta[]> {
  const db = drizzle(d1);
  const rows = await db.select().from(ratingHistory).where(eq(ratingHistory.finishId, finishId)).all();
  return rows.map((row) => ({
    identity: { user_id: row.userId, bot_id: row.botId },
    pool: row.pool,
    mu_before: row.muBefore,
    sigma_before: row.sigmaBefore,
    display_before: row.displayBefore,
    mu_after: row.muAfter,
    sigma_after: row.sigmaAfter,
    display_after: row.displayAfter,
    display_change: row.displayChange,
  }));
}

/** The display upsert after a non-finishing transition — fire-and-forget
 * post-commit (the DO leaves it unawaited; no `waitUntil`), single attempt,
 * re-derivable from the DO at any time. */
export async function updateSummary(d1: D1Database, args: { gameId: string; status?: "active"; pendingPlayers: number[]; turnDeadline: number | null; now: number }): Promise<void> {
  const db = drizzle(d1);
  await db
    .update(games)
    .set({
      ...(args.status !== undefined ? { status: args.status } : {}),
      pendingPlayers: args.pendingPlayers,
      turnDeadline: args.turnDeadline,
      updatedAt: args.now,
    })
    .where(eq(games.id, args.gameId));
}

/** The roster mirror after a committed waiting-room command — the DO's
 * roster is the integrity copy; this rewrites the D1 display copy wholesale
 * (delete + reinsert), which is idempotent and immune to per-row drift.
 * Fire-and-forget post-commit (the DO leaves it unawaited; no `waitUntil`),
 * single attempt. */
export async function mirrorRoster(d1: D1Database, args: { gameId: string; status: GameStatus; seats: Seat[]; now: number }): Promise<void> {
  const db = drizzle(d1);
  const statements = [db.update(games).set({ status: args.status, updatedAt: args.now }).where(eq(games.id, args.gameId)), db.delete(participants).where(eq(participants.gameId, args.gameId))] as const;
  if (args.seats.length === 0) {
    await db.batch([...statements]);
    return;
  }
  await db.batch([...statements, db.insert(participants).values(args.seats.map((s) => ({ id: crypto.randomUUID(), gameId: args.gameId, userId: s.user_id, botId: s.bot_id, playerIndex: s.player_index, type: s.type, createdAt: args.now })))]);
}

/** The worker-direct create, engine-owned so implementors never touch
 * the D1 schema: seats already validated by worker policy. */
export interface CreateGameInput {
  gameId: string;
  createdBy: string | null;
  status: Extract<GameStatus, "waiting" | "ready">;
  access: GameAccess;
  schemaVersion: number;
  config: JsonObject;
  turnSeconds: number | null;
  budgetSeconds: number | null;
  incrementSeconds: number | null;
  rated: boolean;
  ratingPool: string | null;
  minPlayers: number;
  maxPlayers: number;
  shortCode: string;
  seats: Seat[];
  now: number;
}

/** Write the games row + one participants row per seat, atomically. The DO
 * lazy-inits from exactly these rows on first contact. Callers own the
 * short_code retry: a duplicate trips the UNIQUE index and throws. */
export async function createGame(d1: D1Database, input: CreateGameInput): Promise<void> {
  const db = drizzle(d1);
  await db.batch([
    db.insert(games).values({
      id: input.gameId,
      createdBy: input.createdBy,
      status: input.status,
      access: input.access,
      schemaVersion: input.schemaVersion,
      config: input.config,
      turnSeconds: input.turnSeconds,
      budgetSeconds: input.budgetSeconds,
      incrementSeconds: input.incrementSeconds,
      rated: input.rated,
      ratingPool: input.ratingPool,
      minPlayers: input.minPlayers,
      maxPlayers: input.maxPlayers,
      shortCode: input.shortCode,
      createdAt: input.now,
      updatedAt: input.now,
    }),
    db.insert(participants).values(input.seats.map((s) => ({ id: crypto.randomUUID(), gameId: input.gameId, userId: s.user_id, botId: s.bot_id, playerIndex: s.player_index, type: s.type, createdAt: input.now }))),
  ]);
}

/** Lazy-init read: the D1 game + participants rows the DO copies into
 * its `meta`/`roster` on first contact — one batched round trip. */
export async function readGameRow(d1: D1Database, gameId: string) {
  const db = drizzle(d1);
  const [gameRows, seatRows] = await db.batch([
    db.select().from(games).where(eq(games.id, gameId)),
    db.select({ player_index: participants.playerIndex, user_id: participants.userId, bot_id: participants.botId, type: participants.type }).from(participants).where(eq(participants.gameId, gameId)).orderBy(participants.playerIndex),
  ]);
  const game = gameRows[0];
  if (game === undefined) return undefined;
  const roster: Seat[] = seatRows;
  return { ...game, participants: roster };
}
