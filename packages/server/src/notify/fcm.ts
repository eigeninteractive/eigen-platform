/**
 * FCM (HTTP v1) sender (engine_stack.md §7) — mints and **caches its own OAuth
 * access token per isolate**, then posts messages to the FCM endpoint. Pure
 * FCM: no database access (the FID lookup + stale-device pruning live in
 * `push.ts`).
 *
 * Ported from the Supabase-era `_engine/fcm.ts`, adapted off Deno +
 * `google-auth-library` to Workers-native `jose`: we sign the service-account
 * JWT (RS256) ourselves and exchange it at Google's OAuth token endpoint,
 * caching the bearer in module state (the isolate) until shortly before expiry.
 *
 * If Firebase isn't configured (no `FIREBASE_*` service-account vars), callers
 * check {@link readServiceAccount} first and skip — pushes are best-effort by
 * nature (§8), so an unconfigured deployment simply sends none.
 */

import { importPKCS8, SignJWT } from "jose";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const MESSAGING_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
/** Refresh a little before the ~1h expiry so a send never races the boundary. */
const TOKEN_SKEW_MS = 60_000;

/** The Firebase service account the engine signs with, read from env by the
 * documented `FIREBASE_*` convention. */
export interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  /** PKCS#8 PEM. Env storage often escapes newlines — {@link readServiceAccount}
   * un-escapes them. */
  privateKey: string;
}

/** The notification payload — the boundary type for the FCM HTTP v1 API. */
export interface NotificationMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** Resolve the service account from env, or null when FCM is not configured
 * (any of the three vars missing). Mirrors the `FIREBASE_PROJECT_ID` /
 * `BOT_SIGNING_SECRET` env conventions used elsewhere. */
export function readServiceAccount(env: unknown): ServiceAccount | null {
  const e = env as Record<string, unknown>;
  const projectId = e.FIREBASE_PROJECT_ID;
  const clientEmail = e.FIREBASE_CLIENT_EMAIL;
  const privateKey = e.FIREBASE_PRIVATE_KEY;
  if (typeof projectId !== "string" || typeof clientEmail !== "string" || typeof privateKey !== "string") return null;
  if (projectId === "" || clientEmail === "" || privateKey === "") return null;
  return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") };
}

interface CachedToken {
  clientEmail: string;
  token: string;
  expiresAt: number;
}
let cached: CachedToken | null = null;

/** A bearer for the messaging scope — cached per isolate, minted via a signed
 * service-account JWT exchanged at Google's token endpoint. */
async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Date.now();
  if (cached !== null && cached.clientEmail === sa.clientEmail && cached.expiresAt - TOKEN_SKEW_MS > now) {
    return cached.token;
  }
  const key = await importPKCS8(sa.privateKey, "RS256");
  const assertion = await new SignJWT({ scope: MESSAGING_SCOPE }).setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(sa.clientEmail).setSubject(sa.clientEmail).setAudience(TOKEN_URL).setIssuedAt().setExpirationTime("1h").sign(key);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`FCM token exchange failed: HTTP ${res.status}`);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (typeof body.access_token !== "string") throw new Error("FCM token exchange returned no access_token");
  cached = { clientEmail: sa.clientEmail, token: body.access_token, expiresAt: now + (body.expires_in ?? 3600) * 1000 };
  return body.access_token;
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
  const bearer = await accessToken(sa);
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
