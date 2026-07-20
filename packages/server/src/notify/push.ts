/**
 * Turn/finish push orchestration — the DB-touching half
 * of the FCM flow: resolve a user's device FIDs, send, and prune permanently
 * dead installations. The pure send lives in {@link ./fcm.js}.
 *
 * Best-effort and single-attempt: every entry point catches its own
 * errors and logs, so a caller can fire them unawaited without an outer guard
 * (in the DO that's a bare post-commit call — no `waitUntil`). A human's
 * push has no retry — the game state is the truth and the app catches up on
 * open — so a failed send just disappears, and a repeated turn (timeout
 * re-nudge) is the only "retry" there is.
 */

import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { deviceInstallations } from "../d1/schema.js";
import { type NotificationMessage, readServiceAccount, type ServiceAccount, sendNotifications } from "./fcm.js";

async function readUserFids(d1: D1Database, userId: string): Promise<string[]> {
  const rows = await drizzle(d1).select({ fid: deviceInstallations.fid }).from(deviceInstallations).where(eq(deviceInstallations.userId, userId)).all();
  return rows.map((r) => r.fid);
}

async function pruneFids(d1: D1Database, userId: string, fids: string[]): Promise<void> {
  if (fids.length === 0) return;
  await drizzle(d1)
    .delete(deviceInstallations)
    .where(and(eq(deviceInstallations.userId, userId), inArray(deviceInstallations.fid, fids)))
    .run();
}

/** Send `message` to every device registered to `userId`, then prune any
 * permanently unregistered ones. Never throws. */
export async function pushToUser(d1: D1Database, sa: ServiceAccount, userId: string, message: NotificationMessage): Promise<void> {
  try {
    const fids = await readUserFids(d1, userId);
    if (fids.length === 0) return;
    const results = await sendNotifications(sa, message, fids);
    const stale = results.flatMap((r) => (r.status === "fulfilled" && r.value.prunable ? [r.value.fid] : []));
    if (stale.length > 0) await pruneFids(d1, userId, stale);
  } catch (error) {
    console.error(`push to user ${userId} failed`, error);
  }
}

/** The "your turn" push. The engine has no game title, so the copy stays
 * generic; the `deep_link` carries the client to the game. */
export function turnPush(gameId: string): NotificationMessage {
  return { title: "Your turn", body: "It's your move.", data: { category: "your_turn", deep_link: `/game/${gameId}` } };
}

/** The "game over" push. */
export function finishPush(gameId: string): NotificationMessage {
  return { title: "Game over", body: "Your game has finished.", data: { category: "game_finished", deep_link: `/game/${gameId}` } };
}

/** The "someone wants to be friends" push, addressed to the request's recipient. */
export function friendRequestPush(actorName: string): NotificationMessage {
  return { title: `${actorName} wants to be friends`, body: "Tap to respond.", data: { category: "friend_request", deep_link: "/social" } };
}

/** The "your request was accepted" push, addressed to the original requester. */
export function friendAcceptedPush(actorName: string): NotificationMessage {
  return { title: `${actorName} accepted your friend request`, body: "Tap to view.", data: { category: "friend_accepted", deep_link: "/social" } };
}

export { readServiceAccount };
