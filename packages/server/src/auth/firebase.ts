/**
 * Firebase ID-token verification — jose against Google's
 * securetoken JWKS, plus the Firebase claim checks. ~40 lines of our code, by
 * design: the user explicitly rejected `firebase-auth-cloudflare-workers`.
 * Only `FIREBASE_PROJECT_ID` is needed to verify; the service-account trio is
 * for FCM sends and account deletion (later milestones).
 */

import { createRemoteJWKSet, type JWTVerifyGetKey, jwtVerify } from "jose";

/** Verification failure — always the caller's fault; the app maps it to 401. */
export class AuthError extends Error {}

/** What a verified ID token asserts. `isAnonymous` (the
 * `firebase.sign_in_provider === 'anonymous'` claim) drives every guest gate;
 * the profile claims seed user provisioning (Google supplies name/picture,
 * Apple usually only email, guests none). */
export interface AuthClaims {
  uid: string;
  isAnonymous: boolean;
  email: string | null;
  name: string | null;
  picture: string | null;
}

/** The seam `createEngine` consumes. Production is
 * {@link createFirebaseVerifier} with the default remote JWKS; tests inject a
 * local JWKS and mint their own RS256 tokens. */
export interface TokenVerifier {
  /** Resolve a bearer token to claims, or throw {@link AuthError}. */
  verify(token: string): Promise<AuthClaims>;
}

/** Google's JWKS for securetoken (the Firebase ID-token signer). */
const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

/** Cached per isolate — jose caches the fetched keys (and refetches on
 * rotation) inside this resolver, so every verifier shares one cache. */
let remoteJwks: JWTVerifyGetKey | undefined;

function defaultJwks(): JWTVerifyGetKey {
  remoteJwks ??= createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));
  return remoteJwks;
}

export function createFirebaseVerifier(projectId: string, getKey?: JWTVerifyGetKey): TokenVerifier {
  const keys = getKey ?? defaultJwks();
  const issuer = `https://securetoken.google.com/${projectId}`;
  return {
    async verify(token: string): Promise<AuthClaims> {
      let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"];
      try {
        ({ payload } = await jwtVerify(token, keys, { issuer, audience: projectId, algorithms: ["RS256"] }));
      } catch {
        // Deliberately unspecific: signature, expiry, issuer, and audience
        // failures all read the same to a client (re-authenticate).
        throw new AuthError("Invalid or expired token");
      }
      const uid = payload.sub;
      if (typeof uid !== "string" || uid.length === 0) {
        throw new AuthError("Token carries no subject");
      }
      const firebase = payload.firebase as { sign_in_provider?: string } | undefined;
      return {
        uid,
        isAnonymous: firebase?.sign_in_provider === "anonymous",
        email: typeof payload.email === "string" ? payload.email : null,
        name: typeof payload.name === "string" ? payload.name : null,
        picture: typeof payload.picture === "string" ? payload.picture : null,
      };
    },
  };
}
