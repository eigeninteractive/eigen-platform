/**
 * Google service-account OAuth: the shared token step
 * for every Google API the engine calls: FCM (`notify/fcm.ts`) and the
 * Firebase Auth admin delete (`auth/admin.ts`). We sign the
 * service-account JWT (RS256) with `jose` and exchange it at Google's token
 * endpoint, caching the bearer per (client email, scope) in isolate memory
 * until shortly before expiry.
 *
 * `jose` is used rather than `google-auth-library`, which assumes a Node
 * runtime the Workers isolate does not provide. {@link readServiceAccount}
 * keeps parsing separate from deployment policy: `createEngine` requires the
 * credentials for production traffic, while tests with the explicit auth seam
 * can run without making Google calls.
 */

import { importPKCS8, SignJWT } from "jose";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
/** Refresh a little before the ~1h expiry so a call never races the boundary. */
const TOKEN_SKEW_MS = 60_000;

/** The Firebase service account the engine signs with, read from env by the
 * documented `FIREBASE_*` convention. */
export interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  /** PKCS#8 PEM. Env storage often escapes newlines, so {@link readServiceAccount}
   * un-escapes them. */
  privateKey: string;
}

/** Resolve the service account from env, or null when any value is absent.
 *
 * Production policy is enforced by `createEngine`; the nullable parser keeps
 * local tests and inert documentation generation independent of Google. */
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
  token: string;
  expiresAt: number;
}
/** Keyed by `${clientEmail}\n${scope}`, since FCM and admin use different scopes off
 * the same account, so they must not share a cache slot. */
const cache = new Map<string, CachedToken>();

/** A bearer for `scope`, cached per (account, scope) in the isolate, minted
 * via a signed service-account JWT exchanged at Google's token endpoint. */
export async function accessToken(sa: ServiceAccount, scope: string): Promise<string> {
  const now = Date.now();
  const key = `${sa.clientEmail}\n${scope}`;
  const hit = cache.get(key);
  if (hit !== undefined && hit.expiresAt - TOKEN_SKEW_MS > now) return hit.token;

  const signingKey = await importPKCS8(sa.privateKey, "RS256");
  const assertion = await new SignJWT({ scope }).setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(sa.clientEmail).setSubject(sa.clientEmail).setAudience(TOKEN_URL).setIssuedAt().setExpirationTime("1h").sign(signingKey);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: HTTP ${res.status}`);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (typeof body.access_token !== "string") throw new Error("Google token exchange returned no access_token");
  cache.set(key, { token: body.access_token, expiresAt: now + (body.expires_in ?? 3600) * 1000 });
  return body.access_token;
}
