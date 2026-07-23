/**
 * Block enforcement — the interaction and visibility effects of a `blocked`
 * relationship, shared by the read filters (lobby, friends' games) and the
 * seating boundary (join / join-by-code).
 *
 * A block is bidirectional in effect: a `blocked` row between two users, in
 * either direction, hides each from the other's lobby and forbids the two from
 * being seated in the same game. Two rules keep it from doing more than that:
 *
 * - **Forward-only.** Nothing here touches a game already in progress; the
 *   effects gate future visibility and future seating, never eviction.
 * - **Never redacts history.** Finished games and the `players?ids=` identity
 *   lookup are untouched — you already played a blocked user, and rewriting
 *   that record would break rendering a game you both appear in.
 *
 * The `relationships` row is stored once per unordered pair in canonical order
 * (`user_id_1 < user_id_2`); {@link samePair} matches it without knowing which
 * id is smaller.
 */

import { type AnyColumn, and, eq, inArray, notExists, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { games, participants, relationships } from "./schema.js";

/** The canonical pair order the `relationships` unique index is keyed on. */
export function pair(a: string, b: string): { u1: string; u2: string } {
  return a < b ? { u1: a, u2: b } : { u1: b, u2: a };
}

/** A pair-matching predicate that works regardless of which argument is
 * smaller — for the search/read paths where the candidate id is a column. */
export function samePair(colA: AnyColumn, colB: AnyColumn, x: string | AnyColumn, y: string | AnyColumn) {
  return or(and(eq(colA, x), eq(colB, y)), and(eq(colA, y), eq(colB, x)));
}

/** Is `caller` in a block (either direction) with ANY of `ids`? The seating
 * boundary's check: a join is refused when a blocked user already holds a
 * seat. `caller` is filtered out of `ids` first (never blocked with yourself),
 * and an empty set resolves to `false` with no round trip. */
export async function isBlockedAmong(d1: D1Database, caller: string, ids: string[]): Promise<boolean> {
  const others = ids.filter((id) => id !== caller);
  if (others.length === 0) return false;
  const row = await drizzle(d1)
    .select({ one: sql`1` })
    .from(relationships)
    .where(and(eq(relationships.status, "blocked"), or(and(eq(relationships.userId1, caller), inArray(relationships.userId2, others)), and(eq(relationships.userId2, caller), inArray(relationships.userId1, others)))))
    .limit(1)
    .get();
  return row !== undefined;
}

/** A `games`-query condition keeping only games with NO participant
 * blocked-with `caller`.
 *
 * Because the creator holds a participant row like everyone else, this one
 * filter hides both games a blocked user *created* and games they merely
 * *joined*. Correlated on the outer `games.id`, so it drops into any query
 * selecting from `games` (the lobby, friends' open games). A purged seat
 * (`user_id IS NULL`) matches no relationship, so it is never treated as
 * blocked. */
export function noBlockedParticipant(d1: D1Database, caller: string) {
  return notExists(
    drizzle(d1)
      .select({ one: sql`1` })
      .from(participants)
      .innerJoin(relationships, and(eq(relationships.status, "blocked"), samePair(relationships.userId1, relationships.userId2, caller, participants.userId)))
      .where(eq(participants.gameId, games.id)),
  );
}
