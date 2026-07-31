/**
 * FCM (HTTP v1) sender — posts messages to the FCM
 * endpoint with a bearer from the shared `google/oauth` token step. Pure FCM:
 * no database access (the FID lookup + stale-device pruning live in `push.ts`).
 *
 * A production `createEngine` deployment requires the `FIREBASE_*`
 * service-account values. Individual deliveries remain best-effort: game
 * state, rather than an FCM message, is always authoritative.
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

/** One registered installation. Platform is retained for platform-specific
 * delivery options; FID is the HTTP v1 target. */
export interface PushTarget {
  fid: string;
  platform: "ios" | "android" | "web";
}

/** `error.status` values that mean the installation is permanently dead — safe
 * to prune. Firebase documents a send to an unregistered FID as a 404
 * (`NOT_FOUND`); `UNREGISTERED` covers the transitional error spelling.
 * Transient statuses and `INVALID_ARGUMENT` are deliberately retained. */
const PRUNABLE_STATUS = new Set(["NOT_FOUND", "UNREGISTERED"]);

/** One send's result — `prunable` tells the caller to drop a dead device. */
export interface SendResult {
  fid: string;
  prunable: boolean;
}

/** The raw HTTP v1 message for one installation. */
export function fcmMessageForTarget(target: PushTarget, message: NotificationMessage, webAppOrigin?: string): Record<string, unknown> {
  const deepLink = message.data?.deepLink;
  let link: string | undefined;
  if (target.platform === "web" && webAppOrigin !== undefined && deepLink?.startsWith("/") === true) {
    const origin = new URL(webAppOrigin);
    const destination = new URL(deepLink, origin);
    if (origin.protocol === "https:" && destination.origin === origin.origin) {
      link = destination.href;
    }
  }
  return {
    fid: target.fid,
    notification: { title: message.title, body: message.body },
    data: message.data ?? {},
    ...(link === undefined ? {} : { webpush: { fcm_options: { link } } }),
  };
}

/** Send `message` to each FID, best-effort, returning per-FID results. A
 * network/authentication failure rejects the individual settled result; the
 * caller's `allSettled` absorbs it without interrupting the batch. */
export async function sendNotifications(sa: ServiceAccount, message: NotificationMessage, targets: PushTarget[], webAppOrigin?: string): Promise<PromiseSettledResult<SendResult>[]> {
  const bearer = await accessToken(sa, MESSAGING_SCOPE);
  const url = `https://fcm.googleapis.com/v1/projects/${sa.projectId}/messages:send`;
  return Promise.allSettled(
    targets.map(async (target) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: fcmMessageForTarget(target, message, webAppOrigin) }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: { status?: string } };
        const status = errBody.error?.status ?? "";
        console.error(`FCM send failed for ${target.fid}: ${res.status} ${status}`);
        return { fid: target.fid, prunable: PRUNABLE_STATUS.has(status) };
      }
      return { fid: target.fid, prunable: false };
    }),
  );
}
