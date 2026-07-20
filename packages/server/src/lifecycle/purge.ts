/**
 * Account deletion & guest purge (engine_stack.md §4.7) — the one path shared
 * by the `DELETE /api/engine/me` route and the cron guest sweep.
 *
 * Order is **games → Firebase → D1**, a deliberate departure from the old
 * Supabase transaction (which deleted `auth.users` inside the SQL). Here
 * Firebase is a separate system, and our auth middleware re-provisions a
 * `users` row on any valid token — so deleting the D1 row while the Firebase
 * account still lives would let the very next request RESURRECT the user. We
 * therefore:
 *
 *   1. resolve the user's live games and forfeit / cancel / leave each (a
 *      rated forfeit applies ratings while the user row still exists);
 *   2. delete the Firebase account (single attempt, §8) — on failure we throw
 *      BEFORE touching D1, so nothing is half-deleted and a retry is clean;
 *   3. run the D1 purge as one `batch()`.
 *
 * D1 has no FK cascades, so the preserve-vs-delete is explicit (mirrors the
 * old §22 table): seats and created_by are anonymized (SET NULL) to keep
 * finished-game history readable as "Deleted User"; ratings, history,
 * relationships, and device rows are deleted; the `users` row goes last.
 */

import { and, eq, inArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { deleteFirebaseAccount } from "../auth/admin.js";
import { deviceInstallations, games, participants, playerRatings, ratingHistory, relationships, users } from "../d1/schema.js";
import type { ServiceAccount } from "../google/oauth.js";
import type { Command, GameStub } from "../protocol.js";

/** The engine surface the lifecycle paths need — supplied by `createEngine`
 * (route handlers and the `scheduled` handler alike). */
export interface EngineOps {
  d1: D1Database;
  stub(gameId: string): GameStub;
  /** Null when the `FIREBASE_*` service-account vars are unset — the Firebase
   * account then cannot be deleted server-side (see {@link purgeUser}). */
  serviceAccount: ServiceAccount | null;
  /** The avatars R2 bucket, or null when uploads aren't enabled — the user's
   * avatar object (key = uid) is deleted on purge when present. */
  avatarBucket: R2Bucket | null;
}

/** One of the user's still-live games and how the purge must clear their seat. */
interface LiveSeat {
  gameId: string;
  status: "waiting" | "ready" | "active";
  isCreator: boolean;
  seat: number;
}

/** The user's live games (waiting/ready/active) with their seat — through the
 * participants index (§5.2). No limit: a deletion must clear every one. */
async function readLiveSeats(d1: D1Database, userId: string): Promise<LiveSeat[]> {
  const rows = await drizzle(d1)
    .select({ gameId: games.id, status: games.status, createdBy: games.createdBy, seat: participants.playerIndex })
    .from(participants)
    .innerJoin(games, eq(participants.gameId, games.id))
    .where(and(eq(participants.userId, userId), inArray(games.status, ["waiting", "ready", "active"])))
    .all();
  return rows.map((r) => ({ gameId: r.gameId, status: r.status as LiveSeat["status"], isCreator: r.createdBy === userId, seat: r.seat }));
}

/** Clear the user from one live game: forfeit an active game, cancel a lobby
 * they created, else leave it. Single attempt (§8) — a failure logs and the
 * rest of the purge continues (an orphaned seat is caught by the cron reap /
 * timeout, never blocking the account deletion). */
async function clearSeat(ops: EngineOps, userId: string, seat: LiveSeat): Promise<void> {
  const base = { gameId: seat.gameId, commandId: `purge:${userId}:${seat.gameId}`, actor: { userId, botId: null } };
  const cmd: Command = seat.status === "active" ? { kind: "lifecycle", type: "forfeit", seat: seat.seat, ...base } : seat.isCreator ? { kind: "cancel", ...base } : { kind: "leave", ...base };
  try {
    const result = await ops.stub(seat.gameId).handle(cmd);
    if (!result.ok) console.warn(`purge: clearing ${userId} from game ${seat.gameId} (${cmd.kind}) refused: ${result.code} ${result.message}`);
  } catch (error) {
    console.error(`purge: clearing ${userId} from game ${seat.gameId} (${cmd.kind}) failed`, error);
  }
}

/** The §22 preserve-vs-delete, as one D1 transaction. Anonymize the seats and
 * created_by (history stays readable); delete the personal rows; the `users`
 * row last. */
async function purgeD1(d1: D1Database, userId: string): Promise<void> {
  const db = drizzle(d1);
  await db.batch([
    db.update(participants).set({ userId: null }).where(eq(participants.userId, userId)),
    db.update(games).set({ createdBy: null }).where(eq(games.createdBy, userId)),
    db.delete(relationships).where(or(eq(relationships.userId1, userId), eq(relationships.userId2, userId))),
    db.delete(playerRatings).where(eq(playerRatings.userId, userId)),
    db.delete(ratingHistory).where(eq(ratingHistory.userId, userId)),
    db.delete(deviceInstallations).where(eq(deviceInstallations.userId, userId)),
    db.delete(users).where(eq(users.id, userId)),
  ]);
}

/** Delete `userId` end to end (§4.7). Throws only if the Firebase delete
 * fails — the D1 purge is then intentionally skipped so the account stays
 * fully retriable (never resurrectable). The caller decides what a throw
 * means: the route surfaces an error; the cron logs and moves on. */
export async function purgeUser(ops: EngineOps, userId: string): Promise<void> {
  const seats = await readLiveSeats(ops.d1, userId);
  for (const seat of seats) await clearSeat(ops, userId, seat);

  if (ops.serviceAccount !== null) {
    await deleteFirebaseAccount(ops.serviceAccount, userId);
  } else {
    // No service account configured: we cannot delete the Firebase credential,
    // so the D1 row is reclaimed but the account could re-provision on the next
    // request. A real deployment sets FIREBASE_* (§7); tests never re-request.
    console.warn(`purge: FIREBASE_* not configured — deleting D1 data for ${userId} but not the Firebase account`);
  }

  await purgeD1(ops.d1, userId);

  // Best-effort (§8): the avatar object outlives the D1 row otherwise. A
  // failure just leaves an orphaned blob — harmless, no identity points at it.
  if (ops.avatarBucket !== null) {
    await ops.avatarBucket.delete(userId).catch((error) => console.error(`purge: deleting avatar for ${userId} failed`, error));
  }
}
