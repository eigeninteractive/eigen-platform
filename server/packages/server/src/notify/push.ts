/**
 * Turn/finish push orchestration: the DB-touching half
 * of the FCM flow: resolve a user's device FIDs, send, and prune permanently
 * dead installations. The pure send lives in {@link ./fcm.js}.
 *
 * Best-effort and single-attempt: every entry point catches its own
 * errors and logs, so a caller can fire them unawaited without an outer guard
 * (in the DO that's a bare post-commit call, with no `waitUntil`). A human's
 * push has no retry, since the game state is the truth and the app catches up
 * on open, so a failed send just disappears, and a repeated turn (timeout
 * re-nudge) is the only "retry" there is.
 */

import { and, eq, inArray } from "drizzle-orm";
import { orm } from "../d1/orm.js";
import { deviceInstallations } from "../d1/schema.js";
import { type NotificationMessage, type PushTarget, readServiceAccount, type ServiceAccount, sendNotifications } from "./fcm.js";

async function readUserTargets(d1: D1Database, userId: string): Promise<PushTarget[]> {
  return orm(d1).select({ fid: deviceInstallations.fid, platform: deviceInstallations.platform }).from(deviceInstallations).where(eq(deviceInstallations.userId, userId)).all();
}

async function pruneFids(d1: D1Database, userId: string, fids: string[]): Promise<void> {
  if (fids.length === 0) return;
  await orm(d1)
    .delete(deviceInstallations)
    .where(and(eq(deviceInstallations.userId, userId), inArray(deviceInstallations.fid, fids)))
    .run();
}

/** Send `message` to every device registered to `userId`, then prune any
 * permanently unregistered ones. Never throws. */
export async function pushToUser(d1: D1Database, sa: ServiceAccount, userId: string, message: NotificationMessage, webAppOrigin?: string): Promise<void> {
  try {
    const targets = await readUserTargets(d1, userId);
    if (targets.length === 0) return;
    const results = await sendNotifications(sa, message, targets, webAppOrigin);
    const stale = results.flatMap((r) => (r.status === "fulfilled" && r.value.prunable ? [r.value.fid] : []));
    if (stale.length > 0) await pruneFids(d1, userId, stale);
  } catch (error) {
    console.error(`push to user ${userId} failed`, error);
  }
}

/** The "your turn" push. The engine has no game title, so the copy stays
 * generic; the `deepLink` carries the client to the game. */
export function turnPush(gameId: string): NotificationMessage {
  return { title: "Your turn", body: "It's your move.", data: { category: "yourTurn", deepLink: `/game/${gameId}` } };
}

/** The "game over" push. */
export function finishPush(gameId: string): NotificationMessage {
  return { title: "Game over", body: "Your game has finished.", data: { category: "gameFinished", deepLink: `/game/${gameId}` } };
}

/** The "your game is ready to start" push, addressed to the creator when a
 * join fills the lobby while they are away. */
export function readyPush(gameId: string): NotificationMessage {
  return { title: "Ready to start", body: "Your game has enough players. Tap to start.", data: { category: "gameReady", deepLink: `/game/${gameId}` } };
}

/** The "a friend started a game you can join" push, fanned out to the
 * creator's accepted friends when a friends-access game is created. */
export function gameInvitePush(actorName: string, gameId: string): NotificationMessage {
  return { title: `${actorName} started a game`, body: "Tap to join.", data: { category: "gameInvite", deepLink: `/game/${gameId}` } };
}

/** The "someone wants to be friends" push, addressed to the request's recipient. */
export function friendRequestPush(actorName: string): NotificationMessage {
  return { title: `${actorName} wants to be friends`, body: "Tap to respond.", data: { category: "friendRequest", deepLink: "/social" } };
}

/** The "your request was accepted" push, addressed to the original requester. */
export function friendAcceptedPush(actorName: string): NotificationMessage {
  return { title: `${actorName} accepted your friend request`, body: "Tap to view.", data: { category: "friendAccepted", deepLink: "/social" } };
}

export { readServiceAccount };
