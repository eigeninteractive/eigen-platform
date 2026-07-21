/**
 * The social graph — friend relationships, user search, and the "friends' open
 * games" read. All D1-only: social is cross-game and never touches a Durable
 * Object. The `relationships` table stores one row per unordered pair in
 * canonical order (`user_id_1 < user_id_2`) with a `status`
 * (`pending`/`accepted`/`blocked`) and the `initiated_by` actor, so the row is
 * shared by both users and the direction of a request (or a block) is recovered
 * from `initiated_by`.
 *
 * Writes here are pure data effects; the routes own policy (registered caller,
 * self-target, guest target) and the FCM pushes. Reads return identities by
 * reusing the batch player projection.
 */

import { type AnyColumn, and, desc, eq, inArray, ne, notExists, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { type GameWithRoster, withRosters } from "./reads.js";
import { games, relationships, users } from "./schema.js";

/** The canonical pair order the `relationships` unique index is keyed on. */
function pair(a: string, b: string): { u1: string; u2: string } {
  return a < b ? { u1: a, u2: b } : { u1: b, u2: a };
}

/** A pair-matching predicate that works regardless of which argument is
 * smaller — for the search/read paths where the candidate id is a column. */
function samePair(colA: AnyColumn, colB: AnyColumn, x: string | AnyColumn, y: string | AnyColumn) {
  return or(and(eq(colA, x), eq(colB, y)), and(eq(colA, y), eq(colB, x)));
}

/** The outcome of `sendFriendRequest`, telling the route what (if anything) to
 * push and what to report. */
export type SendResult =
  | { outcome: "requested"; notifyUserId: string } // fresh pending → notify the addressee
  | { outcome: "accepted"; notifyUserId: string } // a reverse-pending request auto-accepted → notify the original requester
  | { outcome: "already_pending" } // the caller already has a pending request out
  | { outcome: "already_friends" }
  | { outcome: "blocked" }; // a block exists in either direction

/** Send a friend request. If the target already has a pending request out to
 * the caller, this accepts it instead (auto-accept). A block in either
 * direction refuses. Canonical-order upsert; idempotent on a repeat. */
export async function sendFriendRequest(d1: D1Database, caller: string, target: string): Promise<SendResult> {
  const db = drizzle(d1);
  const { u1, u2 } = pair(caller, target);
  const existing = await db
    .select()
    .from(relationships)
    .where(and(eq(relationships.userId1, u1), eq(relationships.userId2, u2)))
    .get();

  if (existing !== undefined) {
    if (existing.status === "blocked") return { outcome: "blocked" };
    if (existing.status === "accepted") return { outcome: "already_friends" };
    // Pending: whose is it?
    if (existing.initiatedBy === caller) return { outcome: "already_pending" };
    // The target sent us one first — accept it.
    await db
      .update(relationships)
      .set({ status: "accepted", updatedAt: Date.now() })
      .where(and(eq(relationships.userId1, u1), eq(relationships.userId2, u2)));
    return { outcome: "accepted", notifyUserId: target };
  }

  await db.insert(relationships).values({ id: crypto.randomUUID(), userId1: u1, userId2: u2, initiatedBy: caller, status: "pending", createdAt: Date.now(), updatedAt: Date.now() });
  return { outcome: "requested", notifyUserId: target };
}

/** Accept the pending request the target sent the caller. Returns true when a
 * request was actually transitioned (so the route pushes the requester). */
export async function acceptFriendRequest(d1: D1Database, caller: string, target: string): Promise<boolean> {
  const db = drizzle(d1);
  const { u1, u2 } = pair(caller, target);
  const res = await db
    .update(relationships)
    .set({ status: "accepted", updatedAt: Date.now() })
    // Only a request the TARGET initiated is the caller's to accept.
    .where(and(eq(relationships.userId1, u1), eq(relationships.userId2, u2), eq(relationships.status, "pending"), eq(relationships.initiatedBy, target)))
    .run();
  return (res.meta.changes ?? 0) > 0;
}

/** Remove a friendship, withdraw an outgoing request, or decline an incoming
 * one — all the same delete. Never touches a `blocked` row (that is `unblock`'s
 * job). Idempotent. */
export async function removeRelationship(d1: D1Database, caller: string, target: string): Promise<void> {
  const db = drizzle(d1);
  const { u1, u2 } = pair(caller, target);
  await db.delete(relationships).where(and(eq(relationships.userId1, u1), eq(relationships.userId2, u2), inArray(relationships.status, ["pending", "accepted"])));
}

/** Block a user: overwrite any pending/accepted row (or create one) as
 * `blocked`, recording the caller as the blocker. */
export async function blockUser(d1: D1Database, caller: string, target: string): Promise<void> {
  const db = drizzle(d1);
  const { u1, u2 } = pair(caller, target);
  const now = Date.now();
  await db
    .insert(relationships)
    .values({ id: crypto.randomUUID(), userId1: u1, userId2: u2, initiatedBy: caller, status: "blocked", createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: [relationships.userId1, relationships.userId2], set: { status: "blocked", initiatedBy: caller, updatedAt: now } });
}

/** Unblock — only the user who created the block may lift it. Idempotent. */
export async function unblockUser(d1: D1Database, caller: string, target: string): Promise<void> {
  const db = drizzle(d1);
  const { u1, u2 } = pair(caller, target);
  await db.delete(relationships).where(and(eq(relationships.userId1, u1), eq(relationships.userId2, u2), eq(relationships.status, "blocked"), eq(relationships.initiatedBy, caller)));
}

/** The other user's public identity — the shared core of a friend and a
 * pending-request entry. */
interface IdentityFields {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_anonymous: boolean;
}

/** One accepted friend. */
export type FriendEntry = IdentityFields & { since: number };

/** One pending request: a friend entry plus the request's direction relative to
 * the caller (`outgoing` = sent, `incoming` = received). */
export type FriendRequestEntry = FriendEntry & { direction: "incoming" | "outgoing" };

/** Resolve public identities for a batch of user ids, keyed by id. Ids whose
 * identity has vanished (e.g. purged) are simply absent from the map. */
async function resolveIdentities(d1: D1Database, ids: string[]): Promise<Map<string, IdentityFields>> {
  if (ids.length === 0) return new Map();
  const people = await drizzle(d1).select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, isAnonymous: users.isAnonymous }).from(users).where(inArray(users.id, ids)).all();
  return new Map(people.map((p) => [p.id, { user_id: p.id, username: p.username, display_name: p.displayName, avatar_url: p.avatarUrl, is_anonymous: p.isAnonymous }]));
}

/** The caller's accepted friends, newest first. */
export async function listFriends(d1: D1Database, caller: string): Promise<FriendEntry[]> {
  const rows = await drizzle(d1)
    .select()
    .from(relationships)
    .where(and(or(eq(relationships.userId1, caller), eq(relationships.userId2, caller)), eq(relationships.status, "accepted")))
    .orderBy(desc(relationships.updatedAt))
    .all();
  const idents = await resolveIdentities(
    d1,
    rows.map((r) => (r.userId1 === caller ? r.userId2 : r.userId1)),
  );
  return rows.flatMap((r) => {
    const ident = idents.get(r.userId1 === caller ? r.userId2 : r.userId1);
    return ident === undefined ? [] : [{ ...ident, since: r.updatedAt }];
  });
}

/** The caller's pending requests (both incoming and outgoing), newest first. */
export async function listPendingRequests(d1: D1Database, caller: string): Promise<FriendRequestEntry[]> {
  const rows = await drizzle(d1)
    .select()
    .from(relationships)
    .where(and(or(eq(relationships.userId1, caller), eq(relationships.userId2, caller)), eq(relationships.status, "pending")))
    .orderBy(desc(relationships.updatedAt))
    .all();
  const idents = await resolveIdentities(
    d1,
    rows.map((r) => (r.userId1 === caller ? r.userId2 : r.userId1)),
  );
  return rows.flatMap((r) => {
    const ident = idents.get(r.userId1 === caller ? r.userId2 : r.userId1);
    if (ident === undefined) return [];
    return [{ ...ident, direction: (r.initiatedBy === caller ? "outgoing" : "incoming") as "incoming" | "outgoing", since: r.updatedAt }];
  });
}

/** User search for the friend picker: a case-insensitive substring match on
 * username or display name, excluding the caller, guests, and anyone in a
 * blocked relationship with the caller. Prefix and exact matches rank first.
 * `LIKE` for v1 (FTS5 later); the `%` wildcard is stripped from the query so a
 * caller can't force an unbounded scan. */
export async function searchUsers(d1: D1Database, caller: string, query: string, limit: number): Promise<IdentityFields[]> {
  const cleaned = query.replace(/%/g, "").trim();
  if (cleaned === "") return [];
  const like = `%${cleaned}%`;
  const rows = await drizzle(d1)
    .select({ id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, isAnonymous: users.isAnonymous })
    .from(users)
    .where(
      and(
        eq(users.isAnonymous, false),
        ne(users.id, caller),
        or(sql`${users.username} LIKE ${like}`, sql`${users.displayName} LIKE ${like}`),
        // Hide anyone the caller has blocked or been blocked by.
        notExists(
          drizzle(d1)
            .select({ one: sql`1` })
            .from(relationships)
            .where(and(samePair(relationships.userId1, relationships.userId2, caller, users.id), eq(relationships.status, "blocked"))),
        ),
      ),
    )
    // Exact match, then prefix, then any substring; alphabetical within a tier.
    .orderBy(sql`CASE WHEN ${users.username} = ${cleaned} THEN 0 WHEN ${users.username} LIKE ${`${cleaned}%`} THEN 1 ELSE 2 END`, users.username)
    .limit(limit)
    .all();
  return rows.map((p) => ({ user_id: p.id, username: p.username, display_name: p.displayName, avatar_url: p.avatarUrl, is_anonymous: p.isAnonymous }));
}

/** Joinable games created by the caller's accepted friends — the "friends'
 * open games" lobby. Waiting/ready games only, newest first. */
export async function friendsOpenGames(d1: D1Database, caller: string, limit: number): Promise<GameWithRoster[]> {
  const db = drizzle(d1);
  const friends = await db
    .select()
    .from(relationships)
    .where(and(or(eq(relationships.userId1, caller), eq(relationships.userId2, caller)), eq(relationships.status, "accepted")))
    .all();
  const friendIds = friends.map((r) => (r.userId1 === caller ? r.userId2 : r.userId1));
  if (friendIds.length === 0) return [];
  const rows = await db
    .select()
    .from(games)
    .where(and(inArray(games.createdBy, friendIds), inArray(games.status, ["waiting", "ready"])))
    .orderBy(desc(games.createdAt))
    .limit(limit)
    .all();
  return withRosters(d1, rows);
}
