/**
 * The account sync read: everything a device keeps about one account, in one
 * consistent read (decision 0013).
 *
 * Data is returned by its shape. The small sets (ratings, friends and requests,
 * games still in play) are returned WHOLE, because a whole set tells a device
 * what was removed without tombstones: unfriending deletes a relationship row,
 * and leaving a lobby rewrites its roster without the player, and neither leaves
 * anything behind to send. Finished games are the one set that grows without
 * bound, and a finished game does not change, so they are returned
 * INCREMENTALLY, ordered by `finish_seq`, the order finishes committed in.
 *
 * Everything is one `batch()`, which D1 runs as one transaction, so the cursor
 * and the rows it describes can never disagree. Rosters, rating changes, and
 * identities are selected through subqueries over the same game-id sets rather
 * than by binding the ids read a moment earlier: that keeps them inside the
 * transaction, and keeps an account with many open games under D1's limit on
 * bound parameters.
 */

import { and, asc, desc, eq, gt, inArray, max, or, sql } from "drizzle-orm";
import { encodeCursor } from "../cursor.js";
import { orm } from "./orm.js";
import { assembleGames, finishedAtOf, type GameWithRoster, playerColumns, ratingColumns, seatColumns } from "./reads.js";
import { games, participants, playerRatings, ratingHistory, relationships, users } from "./schema.js";

/** Finished games per sync response. A device repeats the call while
 * `hasMoreFinished` is true. */
export const SYNC_FINISHED_PAGE = 50;

type PlayerRow = { id: string; username: string; displayName: string; avatarUrl: string | null; isAnonymous: boolean };

/** Another user's public identity plus when the relationship last changed. */
export interface FriendEntry {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isAnonymous: boolean;
  since: number;
}

/** A pending request, with its direction relative to the caller. */
export type FriendRequestEntry = FriendEntry & { direction: "incoming" | "outgoing" };

export interface AccountSync {
  ratings: { pool: string; mu: number; sigma: number; displayRating: number; updatedAt: number }[];
  friends: FriendEntry[];
  friendRequests: FriendRequestEntry[];
  /** Every game the account holds a seat in that has not ended. */
  activeGames: GameWithRoster[];
  /** Finished games: the increment after `finishedAfter`, or on a first sync
   * the newest page. */
  finishedGames: GameWithRoster[];
  /** Identity for every human seated in the games above. */
  players: PlayerRow[];
  /** The `finish_seq` a device passes as `finishedAfter` next time. */
  finishedCursor: number;
  /** More of the increment remains: call again with `finishedCursor`. */
  hasMoreFinished: boolean;
  /** A first sync only: where the history backfill continues from, or null
   * when the newest page was all the history there is. */
  historyFloor: string | null;
}

/**
 * Read one account's sync.
 *
 * With `finishedAfter`, the finished games are those whose `finish_seq` is
 * greater, ascending. Without it (a device holding nothing), they are instead
 * the newest page in the order history is shown, the cursor is the account's
 * highest `finish_seq` read in the same transaction, and `historyFloor` marks
 * where older games continue. Every finished game is then reached exactly
 * once or more, never zero times: above the cursor through the increment, at or
 * below it through history paging. A game can be reached by both, which a device
 * absorbs by id.
 */
export async function readAccountSync(d1: D1Database, userId: string, finishedAfter: number | null): Promise<AccountSync> {
  const db = orm(d1);
  const first = finishedAfter === null;

  const activeIds = db
    .select({ id: participants.gameId })
    .from(participants)
    .innerJoin(games, eq(games.id, participants.gameId))
    .where(and(eq(participants.userId, userId), inArray(games.status, ["waiting", "ready", "active"])));

  // One extra row, as the paged reads do, so "more remain" is an answer rather
  // than a guess from a short page.
  const finishedOrder = first ? [desc(games.finishedAt), desc(games.id)] : [asc(games.finishSeq)];
  const finishedIds = db
    .select({ id: participants.gameId })
    .from(participants)
    .innerJoin(games, eq(games.id, participants.gameId))
    .where(and(eq(participants.userId, userId), eq(games.status, "finished"), first ? undefined : gt(games.finishSeq, finishedAfter)))
    .orderBy(...finishedOrder)
    .limit(SYNC_FINISHED_PAGE + 1);

  const inSyncedGames = or(inArray(participants.gameId, activeIds), inArray(participants.gameId, finishedIds));
  const otherUser = sql<string>`CASE WHEN ${relationships.userId1} = ${userId} THEN ${relationships.userId2} ELSE ${relationships.userId1} END`;

  const [ratings, relationshipRows, activeRows, finishedRows, seatRows, deltaRows, playerRows, highest] = await db.batch([
    db.select(ratingColumns).from(playerRatings).where(eq(playerRatings.userId, userId)).orderBy(desc(playerRatings.displayRating)),
    db
      .select({ ...playerColumns, status: relationships.status, initiatedBy: relationships.initiatedBy, since: relationships.updatedAt })
      .from(relationships)
      // An inner join, so a relationship whose other user no longer exists is
      // simply not listed.
      .innerJoin(users, eq(users.id, otherUser))
      .where(and(or(eq(relationships.userId1, userId), eq(relationships.userId2, userId)), inArray(relationships.status, ["pending", "accepted"])))
      .orderBy(desc(relationships.updatedAt)),
    db.select().from(games).where(inArray(games.id, activeIds)),
    db
      .select()
      .from(games)
      .where(inArray(games.id, finishedIds))
      .orderBy(...finishedOrder),
    db.select(seatColumns).from(participants).where(inSyncedGames),
    db.select().from(ratingHistory).where(inArray(ratingHistory.gameId, finishedIds)),
    db
      .select(playerColumns)
      .from(users)
      .where(inArray(users.id, db.select({ id: participants.userId }).from(participants).where(inSyncedGames))),
    db
      .select({ value: max(games.finishSeq) })
      .from(participants)
      .innerJoin(games, eq(games.id, participants.gameId))
      .where(and(eq(participants.userId, userId), eq(games.status, "finished"))),
  ]);

  const kept = finishedRows.slice(0, SYNC_FINISHED_PAGE);
  const overflow = finishedRows.length > SYNC_FINISHED_PAGE;
  const last = kept.at(-1);
  const activeGames = assembleGames(activeRows, seatRows, []);
  const finishedGames = assembleGames(kept, seatRows, deltaRows);

  const seated = new Set([...activeGames, ...finishedGames].flatMap((game) => game.participants.flatMap((seat) => (seat.userId === null ? [] : [seat.userId]))));

  return {
    ratings,
    friends: relationshipRows.filter((row) => row.status === "accepted").map(({ status: _status, initiatedBy: _initiatedBy, id, ...identity }) => ({ userId: id, ...identity })),
    friendRequests: relationshipRows.filter((row) => row.status === "pending").map(({ status: _status, initiatedBy, id, ...identity }) => ({ userId: id, ...identity, direction: initiatedBy === userId ? ("outgoing" as const) : ("incoming" as const) })),
    activeGames,
    finishedGames,
    players: playerRows.filter((player) => seated.has(player.id)),
    finishedCursor: first ? (highest[0]?.value ?? 0) : (last?.finishSeq ?? finishedAfter),
    hasMoreFinished: !first && overflow,
    historyFloor: first && overflow && last !== undefined ? encodeCursor({ t: finishedAtOf(last), id: last.id }) : null,
  };
}
