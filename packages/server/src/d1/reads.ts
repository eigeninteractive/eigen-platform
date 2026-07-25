/**
 * Worker → D1 reads: lobby, history lists, profiles,
 * players, bot catalog, and the per-route policy lookups. The rule they all
 * serve: **never wake a Durable Object to serve a read** — only commands, the
 * socket, and range fetches touch the DO.
 */

import type { RatingDelta, Seat } from "@eigeninteractive/kernel";
import { and, desc, eq, inArray, lt, or, type SQLWrapper, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { noBlockedParticipant } from "./blocks.js";
import { bots, games, participants, playerRatings, ratingHistory, relationships, users } from "./schema.js";

export type GameRow = typeof games.$inferSelect;
export type BotRow = typeof bots.$inferSelect;

/** The bot registry row as a discriminated union on `type`. The two
 * `bots` CHECK constraints make these shapes exact at the storage layer —
 * `external` always has a `webhook_url`, the others never do — so narrowing a
 * loaded row is total. */
export type Bot = (Omit<BotRow, "type" | "webhookUrl"> & { type: "engine"; webhookUrl: null }) | (Omit<BotRow, "type" | "webhookUrl"> & { type: "external"; webhookUrl: string }) | (Omit<BotRow, "type" | "webhookUrl"> & { type: "local"; webhookUrl: null });

/** Restate the DB's type/webhook invariant in the type system. The CHECK
 * guarantees the pairing; the guard catches a row that somehow violated it
 * (a hand-edited registry) rather than trusting the cast blindly. */
export function narrowBot(row: BotRow): Bot {
  if (row.type === "external" && row.webhookUrl === null) throw new Error(`bot ${row.id} is type 'external' but has no webhook_url`);
  if (row.type !== "external" && row.webhookUrl !== null) throw new Error(`bot ${row.id} is type '${row.type}' but has a webhook_url`);
  return row as Bot;
}

/** A games row joined with its roster — the create's inverse, and the
 * shape every summary response projects from.
 *
 * `ratings` mirrors `outcomes`: every identity's change, not just the caller's.
 * That keeps the summary per-game rather than viewer-relative, so the same
 * projection is correct on the lobby, another player's history, and the
 * caller's own — and a client picks out its own seat the same way it already
 * does for outcomes. Only populated for finished rated games; absent
 * everywhere else. */
export interface GameWithRoster extends GameRow {
  participants: Seat[];
  ratings?: RatingDelta[];
}

/** Batch-load the rating changes for a page of games.
 *
 * One query for the whole page, like the roster join above — per-game reads
 * would turn a history page into N+1 round trips. Unrated and unfinished games
 * simply have no rows, so they cost nothing beyond the filter. */
async function withRatings(d1: D1Database, rows: GameWithRoster[]): Promise<GameWithRoster[]> {
  const finished = rows.filter((r) => r.status === "finished" && r.rated);
  if (finished.length === 0) return rows;
  const deltaRows = await drizzle(d1)
    .select()
    .from(ratingHistory)
    .where(
      inArray(
        ratingHistory.gameId,
        finished.map((r) => r.id),
      ),
    )
    .all();

  const byGame = new Map<string, RatingDelta[]>();
  for (const row of deltaRows) {
    const delta: RatingDelta = {
      identity: { user_id: row.userId, bot_id: row.botId },
      pool: row.pool,
      mu_before: row.muBefore,
      sigma_before: row.sigmaBefore,
      display_before: row.displayBefore,
      mu_after: row.muAfter,
      sigma_after: row.sigmaAfter,
      display_after: row.displayAfter,
      display_change: row.displayChange,
    };
    const list = byGame.get(row.gameId);
    if (list === undefined) byGame.set(row.gameId, [delta]);
    else list.push(delta);
  }
  return rows.map((row) => {
    const deltas = byGame.get(row.id);
    return deltas === undefined ? row : { ...row, ratings: deltas };
  });
}

export async function withRosters(d1: D1Database, rows: GameRow[]): Promise<GameWithRoster[]> {
  if (rows.length === 0) return [];
  const db = drizzle(d1);
  const seatRows = await db
    .select({ gameId: participants.gameId, player_index: participants.playerIndex, user_id: participants.userId, bot_id: participants.botId, type: participants.type })
    .from(participants)
    .where(
      inArray(
        participants.gameId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(participants.playerIndex)
    .all();
  const byGame = new Map<string, Seat[]>();
  for (const { gameId, ...seat } of seatRows) {
    const list = byGame.get(gameId);
    if (list === undefined) byGame.set(gameId, [seat]);
    else list.push(seat);
  }
  return await withRatings(
    d1,
    rows.map((row) => ({ ...row, participants: byGame.get(row.id) ?? [] })),
  );
}

export async function readGame(d1: D1Database, gameId: string): Promise<GameWithRoster | undefined> {
  const db = drizzle(d1);
  // The games row and its roster are both keyed by the known id, so they go
  // in ONE round trip (mirrors readGameRow's batch in apply.ts). This matters
  // because readGame is on the socket-upgrade path — the "404 without waking a
  // DO for garbage ids" guard — where every connect otherwise pays two
  // sequential D1 trips. withRatings below adds no trip for a live game (it
  // returns early when nothing is finished+rated).
  const [gameRows, seatRows] = await db.batch([
    db.select().from(games).where(eq(games.id, gameId)),
    db.select({ player_index: participants.playerIndex, user_id: participants.userId, bot_id: participants.botId, type: participants.type }).from(participants).where(eq(participants.gameId, gameId)).orderBy(participants.playerIndex),
  ]);
  const row = gameRows[0];
  if (row === undefined) return undefined;
  return (await withRatings(d1, [{ ...row, participants: seatRows }]))[0];
}

/** Join-by-code resolution (worker policy). */
export async function readGameByCode(d1: D1Database, shortCode: string): Promise<GameWithRoster | undefined> {
  const db = drizzle(d1);
  // One round trip, like readGame — but the roster is keyed by game_id, which
  // a code lookup does not yield until it resolves. A subquery bridges the gap:
  // participants are filtered by "the id of the row with this short_code", so
  // both statements still go in a single batch instead of a sequential id
  // lookup. (readGame needs no subquery — it already holds the id.)
  const idForCode = db.select({ id: games.id }).from(games).where(eq(games.shortCode, shortCode));
  const [gameRows, seatRows] = await db.batch([
    db.select().from(games).where(eq(games.shortCode, shortCode)),
    db.select({ player_index: participants.playerIndex, user_id: participants.userId, bot_id: participants.botId, type: participants.type }).from(participants).where(inArray(participants.gameId, idForCode)).orderBy(participants.playerIndex),
  ]);
  const row = gameRows[0];
  if (row === undefined) return undefined;
  return (await withRatings(d1, [{ ...row, participants: seatRows }]))[0];
}

/** Keyset pagination: fetch strictly older than the caller's last row.
 *
 * A cursor rather than an offset because these lists change underneath the
 * reader — a new lobby game shifts every OFFSET by one and makes a scroll show
 * the same row twice. The cursor is the previous page's last sort value, so a
 * page is stable no matter what was inserted since. It also stays index-served
 * at any depth, where OFFSET degrades linearly.
 *
 * Ties are possible (two games created in the same millisecond) and would drop
 * a row; in practice the epoch-ms resolution plus `limit` makes that vanishing,
 * and the alternative — a compound (timestamp, id) cursor — is not worth the
 * wire complexity for a game list. */
function olderThan(column: SQLWrapper, cursor: number | null) {
  return cursor === null ? undefined : lt(column, cursor);
}

/** The lobby page: public joinable games, newest first — exactly the shape
 * `idx_games_lobby` (the ported partial index) serves. When `caller` is given,
 * games seating anyone they have blocked (either direction) are hidden — the
 * creator counts as a participant, so this covers both games a blocked user
 * created and games they joined. */
export async function readLobby(d1: D1Database, limit: number, cursor: number | null = null, caller?: string): Promise<GameWithRoster[]> {
  const rows = await drizzle(d1)
    .select()
    .from(games)
    .where(and(eq(games.access, "public"), inArray(games.status, ["waiting", "ready"]), caller === undefined ? undefined : noBlockedParticipant(d1, caller), olderThan(games.createdAt, cursor)))
    .orderBy(desc(games.createdAt))
    .limit(limit)
    .all();
  return await withRosters(d1, rows);
}

/** "My games" through the participants index (THE access path for
 * games-of-user). `active` = anything still alive; `finished` = the history
 * list, newest finish first (aborted rows carry no finished_at — they sort by
 * updated_at). */
export async function readMyGames(d1: D1Database, userId: string, bucket: "active" | "finished", limit: number, cursor: number | null = null): Promise<GameWithRoster[]> {
  const db = drizzle(d1);
  const statuses: GameRow["status"][] = bucket === "active" ? ["waiting", "ready", "active"] : ["finished", "aborted"];
  const sortKey = bucket === "active" ? games.updatedAt : sql`COALESCE(${games.finishedAt}, ${games.updatedAt})`;
  const order = desc(sortKey);
  const rows = await db
    .select({ games })
    .from(participants)
    .innerJoin(games, eq(participants.gameId, games.id))
    .where(and(eq(participants.userId, userId), inArray(games.status, statuses), olderThan(sortKey, cursor)))
    .orderBy(order)
    .limit(limit)
    .all();
  return await withRosters(
    d1,
    rows.map((r) => r.games),
  );
}

/** Another player's finished PUBLIC games — the replay list on a profile.
 *
 * Public-only is the access rule that makes this safe to expose for an
 * arbitrary id: a private or friends-only game is nobody else's business, and
 * a finished public game is already replayable by anyone who has its id. Same
 * participants index as `readMyGames`, matching either identity column so a
 * bot's game history works too. */
export async function readPlayerPublicGames(d1: D1Database, playerId: string, limit: number, cursor: number | null = null): Promise<GameWithRoster[]> {
  const sortKey = sql`COALESCE(${games.finishedAt}, ${games.updatedAt})`;
  const rows = await drizzle(d1)
    .select({ games })
    .from(participants)
    .innerJoin(games, eq(participants.gameId, games.id))
    .where(and(or(eq(participants.userId, playerId), eq(participants.botId, playerId)), eq(games.status, "finished"), eq(games.access, "public"), olderThan(sortKey, cursor)))
    .orderBy(desc(sortKey))
    .limit(limit)
    .all();
  return await withRosters(
    d1,
    rows.map((r) => r.games),
  );
}

/** The batch identity endpoint (`players?ids=`) — the decided alternative to
 * denormalizing identity onto games rows; the client's persisted player cache
 * keeps it warm. */
export async function readPlayers(d1: D1Database, ids: string[]) {
  if (ids.length === 0) return [];
  return await drizzle(d1).select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, isAnonymous: users.isAnonymous }).from(users).where(inArray(users.id, ids)).all();
}

export async function readBots(d1: D1Database, ids?: string[]): Promise<BotRow[]> {
  const db = drizzle(d1);
  if (ids === undefined) return await db.select().from(bots).all();
  if (ids.length === 0) return [];
  return await db.select().from(bots).where(inArray(bots.id, ids)).all();
}

/** One bot's registry row, narrowed on `type` — the DO's post-commit bot-turn
 * dispatch reads it to route (engine brain / external wake / local skip)
 * and to feed the brain the bot's declared `config`. Off the hot path (a
 * post-commit effect), so a read here costs nothing the human's response
 * waits on. */
export async function readBot(d1: D1Database, id: string): Promise<Bot | undefined> {
  const row = await drizzle(d1).select().from(bots).where(eq(bots.id, id)).get();
  return row === undefined ? undefined : narrowBot(row);
}

/** Friends-access join gate: an accepted relationship between the two
 * users, in canonical pair order. */
export async function isAcceptedFriend(d1: D1Database, userA: string, userB: string): Promise<boolean> {
  const [u1, u2] = userA < userB ? [userA, userB] : [userB, userA];
  const row = await drizzle(d1)
    .select({ id: relationships.id })
    .from(relationships)
    .where(and(eq(relationships.userId1, u1), eq(relationships.userId2, u2), eq(relationships.status, "accepted")))
    .get();
  return row !== undefined;
}

/** Current ratings across pools for one identity (profile screen, profile
 * sheet). Matches either identity column: a rating row is keyed by a user OR a
 * bot, never both, so an id can be looked up without knowing which it is. */
export async function readRatings(d1: D1Database, playerId: string) {
  return await drizzle(d1)
    .select({ pool: playerRatings.pool, mu: playerRatings.mu, sigma: playerRatings.sigma, displayRating: playerRatings.displayRating, updatedAt: playerRatings.updatedAt })
    .from(playerRatings)
    .where(or(eq(playerRatings.userId, playerId), eq(playerRatings.botId, playerId)))
    .orderBy(desc(playerRatings.displayRating))
    .all();
}

/** The per-user rating history screen, newest first, optionally one pool —
 * served by `idx_rating_history_user_pool`. */
export async function readRatingHistory(d1: D1Database, userId: string, pool: string | null, limit: number) {
  const where = pool === null ? eq(ratingHistory.userId, userId) : and(eq(ratingHistory.userId, userId), eq(ratingHistory.pool, pool));
  return await drizzle(d1)
    .select({
      gameId: ratingHistory.gameId,
      pool: ratingHistory.pool,
      displayBefore: ratingHistory.displayBefore,
      displayAfter: ratingHistory.displayAfter,
      displayChange: ratingHistory.displayChange,
      createdAt: ratingHistory.createdAt,
    })
    .from(ratingHistory)
    .where(where)
    .orderBy(desc(ratingHistory.createdAt))
    .limit(limit)
    .all();
}

/** Guard against `inArray` with a caller-controlled unbounded list. */
export function clampIds(ids: string[], max: number): string[] {
  return [...new Set(ids)].slice(0, max);
}
