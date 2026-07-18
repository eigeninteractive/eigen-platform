/**
 * Worker → D1 reads (engine_stack.md §5.2): lobby, history lists, profiles,
 * players, bot catalog, and the per-route policy lookups. The rule they all
 * serve: **never wake a Durable Object to serve a read** — only commands, the
 * socket, range fetches, and the local-bot observation touch the DO.
 */

import type { Seat } from "@eigen/kernel";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { bots, games, participants, playerRatings, ratingHistory, relationships, users } from "./schema.js";

export type GameRow = typeof games.$inferSelect;
export type BotRow = typeof bots.$inferSelect;

/** A games row joined with its roster — the §4.1 create's inverse, and the
 * shape every summary response projects from. */
export interface GameWithRoster extends GameRow {
  participants: Seat[];
}

async function withRosters(d1: D1Database, rows: GameRow[]): Promise<GameWithRoster[]> {
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
  return rows.map((row) => ({ ...row, participants: byGame.get(row.id) ?? [] }));
}

export async function readGame(d1: D1Database, gameId: string): Promise<GameWithRoster | undefined> {
  const row = await drizzle(d1).select().from(games).where(eq(games.id, gameId)).get();
  if (row === undefined) return undefined;
  return (await withRosters(d1, [row]))[0];
}

/** Join-by-code resolution (§4.2 worker policy). */
export async function readGameByCode(d1: D1Database, shortCode: string): Promise<GameWithRoster | undefined> {
  const row = await drizzle(d1).select().from(games).where(eq(games.shortCode, shortCode)).get();
  if (row === undefined) return undefined;
  return (await withRosters(d1, [row]))[0];
}

/** The caller's seat in a game, resolved through the participants unique
 * index — the action/forfeit routes' policy lookup. */
export async function readSeatOf(d1: D1Database, gameId: string, userId: string): Promise<number | null> {
  const row = await drizzle(d1)
    .select({ playerIndex: participants.playerIndex })
    .from(participants)
    .where(and(eq(participants.gameId, gameId), eq(participants.userId, userId)))
    .get();
  return row?.playerIndex ?? null;
}

/** The lobby page: public joinable games, newest first — exactly the shape
 * `idx_games_lobby` (the ported partial index) serves. */
export async function readLobby(d1: D1Database, limit: number): Promise<GameWithRoster[]> {
  const rows = await drizzle(d1)
    .select()
    .from(games)
    .where(and(eq(games.access, "public"), inArray(games.status, ["waiting", "ready"])))
    .orderBy(desc(games.createdAt))
    .limit(limit)
    .all();
  return await withRosters(d1, rows);
}

/** "My games" through the participants index (§5.2: THE access path for
 * games-of-user). `active` = anything still alive; `finished` = the history
 * list, newest finish first (aborted rows carry no finished_at — they sort by
 * updated_at). */
export async function readMyGames(d1: D1Database, userId: string, bucket: "active" | "finished", limit: number): Promise<GameWithRoster[]> {
  const db = drizzle(d1);
  const statuses: GameRow["status"][] = bucket === "active" ? ["waiting", "ready", "active"] : ["finished", "aborted"];
  const order = bucket === "active" ? desc(games.updatedAt) : desc(sql`COALESCE(${games.finishedAt}, ${games.updatedAt})`);
  const rows = await db
    .select({ games })
    .from(participants)
    .innerJoin(games, eq(participants.gameId, games.id))
    .where(and(eq(participants.userId, userId), inArray(games.status, statuses)))
    .orderBy(order)
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

/** Friends-access join gate (§4.2): an accepted relationship between the two
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

/** Current ratings across pools for one identity (profile screen). */
export async function readRatings(d1: D1Database, userId: string) {
  return await drizzle(d1).select({ pool: playerRatings.pool, mu: playerRatings.mu, sigma: playerRatings.sigma, displayRating: playerRatings.displayRating, updatedAt: playerRatings.updatedAt }).from(playerRatings).where(eq(playerRatings.userId, userId)).all();
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
