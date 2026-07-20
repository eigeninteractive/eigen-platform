/**
 * FCM (HTTP v1) sender (engine_stack.md §7) — posts messages to the FCM
 * endpoint with a bearer from the shared `google/oauth` token step. Pure FCM:
 * no database access (the FID lookup + stale-device pruning live in `push.ts`).
 *
 * If Firebase isn't configured (no `FIREBASE_*` service-account vars), callers
 * check {@link readServiceAccount} first and skip — pushes are best-effort by
 * nature (§8), so an unconfigured deployment simply sends none.
 */

import { accessToken, readServiceAccount, type ServiceAccount } from "../google/oauth.js";

const MESSAGING_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

// Re-exported so `push.ts` and the DO keep importing the service-account
// surface from `notify` — the token plumbing moved to `google/oauth`.
export { readServiceAccount, type ServiceAccount };

/** The notification payload — the boundary type for the FCM HTTP v1 API. */
export interface NotificationMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** `error.status` values that mean the installation is permanently dead — safe
 * to prune. Deliberately narrow: transient statuses (5xx / `QUOTA_EXCEEDED`)
 * are left for the next send; `INVALID_ARGUMENT` covers both a bad FID and a
 * malformed payload, so it is excluded. */
const PRUNABLE_STATUS = new Set(["UNREGISTERED"]);

/** One send's result — `prunable` tells the caller to drop a dead device. */
export interface SendResult {
  fid: string;
  prunable: boolean;
}

/** Send `message` to each FID, best-effort, returning per-FID results. A
 * network/token failure rejects the individual settled result; the caller's
 * `allSettled` absorbs it without interrupting the batch. */
export async function sendNotifications(sa: ServiceAccount, message: NotificationMessage, fids: string[]): Promise<PromiseSettledResult<SendResult>[]> {
  const bearer = await accessToken(sa, MESSAGING_SCOPE);
  const url = `https://fcm.googleapis.com/v1/projects/${sa.projectId}/messages:send`;
  return Promise.allSettled(
    fids.map(async (fid) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: { fid, notification: { title: message.title, body: message.body }, data: message.data ?? {} } }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: { status?: string } };
        const status = errBody.error?.status ?? "";
        console.error(`FCM send failed for ${fid}: ${res.status} ${status}`);
        return { fid, prunable: PRUNABLE_STATUS.has(status) };
      }
      return { fid, prunable: false };
    }),
  );
}
