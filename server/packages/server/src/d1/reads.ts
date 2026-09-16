/**
 * Worker → D1 reads: lobby, history lists, profiles,
 * players, bot catalog, and the per-route policy lookups. The rule they all
 * serve: **never wake a Durable Object to serve a read**. Only commands, the
 * socket, and range fetches touch the DO.
 */

import { GameBugError, type RatingDelta, type Seat } from "@eigeninteractive/kernel";
import { and, desc, eq, inArray, or, type SQLWrapper, sql } from "drizzle-orm";
import { type Cursor, encodeCursor, type Page } from "../cursor.js";
import { noBlockedParticipant } from "./blocks.js";
import { orm } from "./orm.js";
import { bots, games, participants, playerRatings, ratingHistory, relationships, users } from "./schema.js";

export type GameRow = typeof games.$inferSelect;
export type BotRow = typeof bots.$inferSelect;

/** The bot registry row as a discriminated union on `type`. The two
 * `bots` CHECK constraints make these shapes exact at the storage layer
 * (`external` always has a `webhook_url`, the others never do) so narrowing a
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

/** A games row joined with its roster: the create's inverse, and the
 * shape every summary response projects from.
 *
 * `ratings` mirrors `outcomes`: every identity's change, not just the caller's.
 * That keeps the summary per-game rather than viewer-relative, so the same
 * projection is correct on the lobby, another player's history, and the
 * caller's own, and a client picks out its own seat the same way it already
 * does for outcomes. Only populated for finished rated games; absent
 * everywhere else. */
export interface GameWithRoster extends GameRow {
  participants: Seat[];
  ratings?: RatingDelta[];
}

/** Rebuild a {@link RatingDelta} from its stored `ratingHistory` row: the
 * inverse of the write in `applyFinish`. Shared by the game assembly below and
 * the crash-recovery rebuild (`recoverDeltas`), so the flat-row → nested-delta
 * shape lives in exactly one place. */
export function ratingDeltaFromRow(row: typeof ratingHistory.$inferSelect): RatingDelta {
  return {
    identity: { userId: row.userId, botId: row.botId },
    pool: row.pool,
    muBefore: row.muBefore,
    sigmaBefore: row.sigmaBefore,
    displayBefore: row.displayBefore,
    muAfter: row.muAfter,
    sigmaAfter: row.sigmaAfter,
    displayAfter: row.displayAfter,
    displayChange: row.displayChange,
  };
}

/** One seat as the roster reads select it: the seat plus the game it belongs
 * to, so rows for many games can be grouped in one pass. */
export type SeatRow = Seat & { gameId: string };

/** The columns every roster read selects. */
export const seatColumns = { gameId: participants.gameId, playerIndex: participants.playerIndex, userId: participants.userId, botId: participants.botId, type: participants.type };

/** Join game rows to their seats and rating changes, all already read.
 *
 * Pure, so a caller that read all three in one batch (the account sync) and one
 * that read them one after another (a page) build the identical shape. Rating
 * rows exist only for finished rated games, so an unrated or live game simply
 * gets none. */
export function assembleGames(rows: GameRow[], seats: SeatRow[], deltaRows: (typeof ratingHistory.$inferSelect)[]): GameWithRoster[] {
  const seatsByGame = new Map<string, Seat[]>();
  for (const { gameId, ...seat } of seats) {
    const list = seatsByGame.get(gameId);
    if (list === undefined) seatsByGame.set(gameId, [seat]);
    else list.push(seat);
  }
  const deltasByGame = new Map<string, RatingDelta[]>();
  for (const row of deltaRows) {
    const list = deltasByGame.get(row.gameId);
    if (list === undefined) deltasByGame.set(row.gameId, [ratingDeltaFromRow(row)]);
    else list.push(ratingDeltaFromRow(row));
  }
  return rows.map((row) => {
    const roster = (seatsByGame.get(row.id) ?? []).sort((a, b) => a.playerIndex - b.playerIndex);
    const deltas = deltasByGame.get(row.id);
    return deltas === undefined ? { ...row, participants: roster } : { ...row, participants: roster, ratings: deltas };
  });
}

/** Rosters and rating changes for a page of games: two reads for the whole
 * page, never one per game. */
export async function withRosters(d1: D1Database, rows: GameRow[]): Promise<GameWithRoster[]> {
  if (rows.length === 0) return [];
  const db = orm(d1);
  const finishedRated = rows.filter((r) => r.status === "finished" && r.rated).map((r) => r.id);
  const seats = await db
    .select(seatColumns)
    .from(participants)
    .where(
      inArray(
        participants.gameId,
        rows.map((r) => r.id),
      ),
    )
    .all();
  const deltaRows = finishedRated.length === 0 ? [] : await db.select().from(ratingHistory).where(inArray(ratingHistory.gameId, finishedRated)).all();
  return assembleGames(rows, seats, deltaRows);
}

/** One game with the roster its caller already read, plus its rating changes,
 * which cost a read only for a finished rated game. */
async function withRatingsOf(d1: D1Database, row: GameRow, seats: Seat[]): Promise<GameWithRoster> {
  const deltaRows = row.status === "finished" && row.rated ? await orm(d1).select().from(ratingHistory).where(eq(ratingHistory.gameId, row.id)).all() : [];
  const [game] = assembleGames(
    [row],
    seats.map((seat) => ({ ...seat, gameId: row.id })),
    deltaRows,
  );
  return game as GameWithRoster;
}

export async function readGame(d1: D1Database, gameId: string): Promise<GameWithRoster | undefined> {
  const db = orm(d1);
  // The games row and its roster are both keyed by the known id, so they go
  // in ONE round trip (mirrors readGameRow's batch in apply.ts). This matters
  // because readGame is on the socket-upgrade path (the "404 without waking a
  // DO for garbage ids" guard) where every connect otherwise pays two
  // sequential D1 trips. The rating read adds no trip for a live game.
  const [gameRows, seatRows] = await db.batch([
    db.select().from(games).where(eq(games.id, gameId)),
    db.select({ playerIndex: participants.playerIndex, userId: participants.userId, botId: participants.botId, type: participants.type }).from(participants).where(eq(participants.gameId, gameId)).orderBy(participants.playerIndex),
  ]);
  const row = gameRows[0];
  if (row === undefined) return undefined;
  return await withRatingsOf(d1, row, seatRows);
}

/** Cheap public-command guard: reject arbitrary ids before deriving and waking
 * a Durable Object. Games are retained indefinitely, so existence is monotonic
 * and this single indexed lookup cannot race with a later deletion. */
export async function gameExists(d1: D1Database, gameId: string): Promise<boolean> {
  const row = await orm(d1).select({ id: games.id }).from(games).where(eq(games.id, gameId)).get();
  return row !== undefined;
}

/** Join-by-code resolution (worker policy). */
export async function readGameByCode(d1: D1Database, shortCode: string): Promise<GameWithRoster | undefined> {
  const db = orm(d1);
  // One round trip, like readGame, but the roster is keyed by gameId, which
  // a code lookup does not yield until it resolves. A subquery bridges the gap:
  // participants are filtered by "the id of the row with this shortCode", so
  // both statements still go in a single batch instead of a sequential id
  // lookup. (readGame needs no subquery; it already holds the id.)
  const idForCode = db.select({ id: games.id }).from(games).where(eq(games.shortCode, shortCode));
  const [gameRows, seatRows] = await db.batch([
    db.select().from(games).where(eq(games.shortCode, shortCode)),
    db.select({ playerIndex: participants.playerIndex, userId: participants.userId, botId: participants.botId, type: participants.type }).from(participants).where(inArray(participants.gameId, idForCode)).orderBy(participants.playerIndex),
  ]);
  const row = gameRows[0];
  if (row === undefined) return undefined;
  return await withRatingsOf(d1, row, seatRows);
}

/** Keyset pagination: fetch strictly after the caller's last row, in the
 * list's own descending order.
 *
 * A cursor rather than an offset because these lists change underneath the
 * reader: a new lobby game shifts every OFFSET by one and makes a scroll show
 * the same row twice. A cursor names a position rather than a count, so a page
 * is stable no matter what was inserted since, and it stays index-served at any
 * depth where OFFSET degrades linearly.
 *
 * The comparison is on the PAIR (sort value, id), not on the sort value alone.
 * Timestamps tie - two games created in the same millisecond share one - and
 * under a `sortKey < cursor` boundary a tied row is neither after the page just
 * served nor on it, so it is skipped and never seen again. Ordering by
 * `(sortKey, id)` makes the ordering total, and comparing lexicographically
 * places the boundary exactly between two rows however many share a timestamp.
 * The id's own order is arbitrary (they are UUIDs); all a tiebreak needs is to
 * be consistent, and the same expression drives both the ORDER BY and this. */
export function afterCursor(sortKey: SQLWrapper, id: SQLWrapper, cursor: Cursor | null) {
  if (cursor === null) return undefined;
  // Spelled as a SQLite row value (3.15+) rather than expanded by hand into
  // `sortKey < t OR (sortKey = t AND id < cursorId)`. The two are equivalent,
  // but the expansion mentions `sortKey` twice, which is the kind of thing that
  // silently stops matching its own ORDER BY when one copy is edited. SQLite
  // plans a row-value comparison against the same index it would use for the
  // expansion.
  return sql`(${sortKey}, ${id}) < (${cursor.t}, ${cursor.id})`;
}

/** Turn an over-fetched row set into a page plus the cursor that continues it.
 *
 * The reads ask D1 for `limit + 1` rows and this discards the extra. That one
 * wasted row is what lets `nextCursor` be null exactly when the list is
 * exhausted, rather than null when a page came back short - which is a guess,
 * and it is wrong precisely when the final page is exactly full. */
export async function pageOf(d1: D1Database, rows: GameRow[], limit: number, sortValue: (row: GameRow) => number): Promise<Page<GameWithRoster>> {
  const hasMore = rows.length > limit;
  const kept = hasMore ? rows.slice(0, limit) : rows;
  const last = kept.at(-1);
  return {
    rows: await withRosters(d1, kept),
    nextCursor: hasMore && last !== undefined ? encodeCursor({ t: sortValue(last), id: last.id }) : null,
  };
}

/** When a finished game finished. The finish apply writes this in the same
 * statement that makes the row `finished`, so a finished row without one is a
 * bug rather than a state to sort around. (An aborted game is never listed: it
 * keeps no roster, so no participants read reaches it.) */
export function finishedAtOf(row: GameRow): number {
  if (row.finishedAt === null) throw new GameBugError(`finished game ${row.id} has no finishedAt`);
  return row.finishedAt;
}

/** The lobby page: public joinable games, newest first, exactly the shape
 * `idx_games_lobby` (the ported partial index) serves. When `caller` is given,
 * games seating anyone they have blocked (either direction) are hidden. The
 * creator counts as a participant, so this covers both games a blocked user
 * created and games they joined. */
export async function readLobby(d1: D1Database, limit: number, cursor: Cursor | null = null, caller?: string): Promise<Page<GameWithRoster>> {
  const rows = await orm(d1)
    .select()
    .from(games)
    .where(and(eq(games.access, "public"), inArray(games.status, ["waiting", "ready"]), caller === undefined ? undefined : noBlockedParticipant(d1, caller), afterCursor(games.createdAt, games.id, cursor)))
    .orderBy(desc(games.createdAt), desc(games.id))
    .limit(limit + 1)
    .all();
  return await pageOf(d1, rows, limit, (row) => row.createdAt);
}

/** The caller's finished games older than a position, newest first: history
 * past what a device already holds.
 *
 * The newest page of history arrives with the account sync, which also hands
 * back the position its oldest game sits at; this continues from there. Paged
 * by when games finished, the order history is shown in, rather than by the
 * sync's commit order, which is not. */
export async function readMyFinishedGames(d1: D1Database, userId: string, limit: number, cursor: Cursor | null = null): Promise<Page<GameWithRoster>> {
  const rows = await orm(d1)
    .select({ games })
    .from(participants)
    .innerJoin(games, eq(participants.gameId, games.id))
    .where(and(eq(participants.userId, userId), eq(games.status, "finished"), afterCursor(games.finishedAt, games.id, cursor)))
    .orderBy(desc(games.finishedAt), desc(games.id))
    .limit(limit + 1)
    .all();
  return await pageOf(
    d1,
    rows.map((r) => r.games),
    limit,
    finishedAtOf,
  );
}

/** Another player's finished PUBLIC games: the replay list on a profile.
 *
 * Public-only is the access rule that makes this safe to expose for an
 * arbitrary id: a private or friends-only game is nobody else's business, and
 * a finished public game is already replayable by anyone who has its id. Same
 * participants index as `readMyFinishedGames`, matching either identity column
 * so a bot's game history works too. */
export async function readPlayerPublicGames(d1: D1Database, playerId: string, limit: number, cursor: Cursor | null = null): Promise<Page<GameWithRoster>> {
  const rows = await orm(d1)
    .select({ games })
    .from(participants)
    .innerJoin(games, eq(participants.gameId, games.id))
    .where(and(or(eq(participants.userId, playerId), eq(participants.botId, playerId)), eq(games.status, "finished"), eq(games.access, "public"), afterCursor(games.finishedAt, games.id, cursor)))
    .orderBy(desc(games.finishedAt), desc(games.id))
    .limit(limit + 1)
    .all();
  return await pageOf(
    d1,
    rows.map((r) => r.games),
    limit,
    finishedAtOf,
  );
}

/** The public identity columns: what the batch players read, search, and the
 * account sync all project. */
export const playerColumns = { id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, isAnonymous: users.isAnonymous };

/** The batch identity endpoint (`players?ids=`), and why games rows carry no
 * denormalized identity; the device keeps the identities it has seen. */
export async function readPlayers(d1: D1Database, ids: string[]) {
  if (ids.length === 0) return [];
  return await orm(d1).select(playerColumns).from(users).where(inArray(users.id, ids)).all();
}

export async function readBots(d1: D1Database, ids?: string[]): Promise<BotRow[]> {
  const db = orm(d1);
  if (ids === undefined) return await db.select().from(bots).all();
  if (ids.length === 0) return [];
  return await db.select().from(bots).where(inArray(bots.id, ids)).all();
}

/** One bot's registry row, narrowed on `type`. The DO's post-commit bot-turn
 * dispatch reads it to route (engine brain / external wake / local skip)
 * and to feed the brain the bot's declared `config`. Off the hot path (a
 * post-commit effect), so a read here costs nothing the human's response
 * waits on. */
export async function readBot(d1: D1Database, id: string): Promise<Bot | undefined> {
  const row = await orm(d1).select().from(bots).where(eq(bots.id, id)).get();
  return row === undefined ? undefined : narrowBot(row);
}

/** Friends-access join gate: an accepted relationship between the two
 * users, in canonical pair order. */
export async function isAcceptedFriend(d1: D1Database, userA: string, userB: string): Promise<boolean> {
  const [u1, u2] = userA < userB ? [userA, userB] : [userB, userA];
  const row = await orm(d1)
    .select({ id: relationships.id })
    .from(relationships)
    .where(and(eq(relationships.userId1, u1), eq(relationships.userId2, u2), eq(relationships.status, "accepted")))
    .get();
  return row !== undefined;
}

/** The rating columns every ratings read projects. */
export const ratingColumns = { pool: playerRatings.pool, mu: playerRatings.mu, sigma: playerRatings.sigma, displayRating: playerRatings.displayRating, updatedAt: playerRatings.updatedAt };

/** Current ratings across pools for one identity (profile screen, profile
 * sheet). Matches either identity column: a rating row is keyed by a user OR a
 * bot, never both, so an id can be looked up without knowing which it is. */
export async function readRatings(d1: D1Database, playerId: string) {
  return await orm(d1)
    .select(ratingColumns)
    .from(playerRatings)
    .where(or(eq(playerRatings.userId, playerId), eq(playerRatings.botId, playerId)))
    .orderBy(desc(playerRatings.displayRating))
    .all();
}

/** Guard against `inArray` with a caller-controlled unbounded list. */
export function clampIds(ids: string[], max: number): string[] {
  return [...new Set(ids)].slice(0, max);
}
