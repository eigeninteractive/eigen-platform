/**
 * `@eigen/server/testing` — the test-auth recipe, for the engine's own
 * suite and for implementor test workers alike:
 *
 * ```ts
 * // test/worker.ts — your production entry, with the test verifier:
 * export default createEngine({ ...same config, auth: testVerifier() });
 * // a spec:
 * await SELF.fetch(url, { headers: await testBearer({ uid: "alice" }) });
 * ```
 *
 * Tokens are verified through the SAME jose code path production uses — only
 * the JWKS is local. The RS256 keypair below is a public fixture (checked in,
 * shipped in the package); it protects nothing and must never reach a
 * production config: pass `auth` ONLY in test workers.
 */

import { createLocalJWKSet, importJWK, type JWK, SignJWT } from "jose";
import { createFirebaseVerifier, type TokenVerifier } from "./auth/firebase.js";

export const TEST_PROJECT_ID = "eigen-test";
const TEST_ISSUER = `https://securetoken.google.com/${TEST_PROJECT_ID}`;
const KID = "eigen-test-key";

const publicJwk: JWK = {
  kty: "RSA",
  n: "wuuh7PQoV2Y2pVM1gWE4oNIAm74TqLyGKlTcX58ol7hM0UcS5MKgu0Dh0bDfmqOtGkPRPJet494SjVf1gPLOVb6e2yODckvszBTJryZc32YPIw0ky9cqCpDtClgKj7C9PKoKDfalRdRn_eQbs0bM2_-74oOcQwZgvzrBdC9L8xhRHX3dppx51pVDaDCAIcUNZsC-pOJrW_66t5ja7kOAqspMoJN2Nbvk2G6waLXvfKyYtTxlzi3U9chv_tG16cft6CnpO2p_qAgJTGFLTUH4Z5n7yJbYbGeYIzBZECet7dRcBn1jnAoYXGzSQBwFFM_Bm25NCGPC32eEQ8HFf3V4Uw",
  e: "AQAB",
  kid: KID,
  alg: "RS256",
  use: "sig",
};

const privateJwk: JWK = {
  ...publicJwk,
  d: "WTqm4KMQiJno8Bu8RaLs2mnoD2Oe-kJ7JIu-aiOg4Htk5vSjSId0LuRPu789TTwaNQjQku1YlBSH555Za5M7M3NUozqJpNvu5amqffyQzU-aJFCTBKFVxIp9iJuvEgI1Tr0EZ0n-dI38oPQ4XgROKXPTXakj8mbMCR5rirVQDlLIKaK2pvIyJAOmUUp71gUfGbMM_fke_VqHsHEELYIAi1i_giciO5s48WSWFT6g18IqKBhvCxX2J7nkLcqXamRn3SWoYxpP_z3AMg7pKu2QhTtsLHocTmyAjIMvn47bo6X0idEfoOBBXZY_1HUwPRkHQseys91UE4NRBVedGQXZuQ",
  p: "_k3Q0w8ES9f0tONxzkCBl-uFr8JFLbgSMTXOUWK3oo-Hp8vkPdLJMhWM7QH1vXyqd_i503wVbMv5JQp7Q_su93O0Qp0BhVdPU1YToBpi7jVEabyRnEQUCcn5mnMNJWovVvvTTLUlMyxRiJKJkJMIXoOAfkS2B7EnF5KjDw-isqc",
  q: "xDhtv9HpHWnC6p3ByGCV4xti3hFDcHWIrKwD5CLRlzgvU4dca7k69_EkwI-x3hmMM61xtYYLZFWrUXn1afq3SXfeS6zz9GfdhMVOQ54OoiNIToI8IUPshQweuQ-UNE5IShoATbfellgJOEO6XeRVUqBWruoK_3amttaklXoL3nU",
  dp: "F71f7zQJrKLeXzyUVTLEZlBATKYQGzKB0EI7nnFevzgy68Em73aL_bbxTvbN4ACRUV3QyyNcRKnN-l0-IJyER-lvPIC3saDy8M6qSlnsPlyOpGhMF5BrZnaKbJas9X8yKCaeFR0b-ej7O4qiePKg52HTTvZPH-yzv4ma2z8UayU",
  dq: "B-hCO_WokD_f0_aRhZKm16UV4d8OOazy2gqAiaQBkDd6aMJOriSjxLQaCAyCXXHoHXkC2Q7SzLNLGRhyFFg_JJ3I_oG0vwekfKI62iy3aD9Fvawv4iNLl7z6S_jdvxHchefwVTFwrdxUWskX7Iq0CYVemOPjl5HffATAUym86rU",
  qi: "-t4zj-6GUbBv3JAVeLL4JXK0kNlkvp23F-dg4i40THOtlAbuCc5rq7WYDivw7eDq-Z9lbbjOcjspo8rk49GsKFblgYUVCfmdl8hRYyouNs_eg-yqJtCEakGA5hf_kGaIh_9-rIHooZl-XxV7edRFRf6c7Z0V5ehXMpYinl-ZmZo",
};

/** The verifier a test worker passes as `createEngine({ auth })`. */
export function testVerifier(): TokenVerifier {
  return createFirebaseVerifier(TEST_PROJECT_ID, createLocalJWKSet({ keys: [publicJwk] }));
}

export interface TestTokenOptions {
  uid: string;
  anonymous?: boolean;
  email?: string;
  name?: string;
  picture?: string;
  /** Override any registered claim (e.g. an expired `exp`, a wrong `aud`). */
  claims?: Record<string, unknown>;
}

export async function mintTestToken(opts: TestTokenOptions): Promise<string> {
  const key = await importJWK(privateJwk, "RS256");
  const jwt = new SignJWT({
    firebase: { sign_in_provider: opts.anonymous === true ? "anonymous" : "google.com" },
    ...(opts.email !== undefined ? { email: opts.email } : {}),
    ...(opts.name !== undefined ? { name: opts.name } : {}),
    ...(opts.picture !== undefined ? { picture: opts.picture } : {}),
    ...opts.claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: KID })
    .setSubject(opts.uid)
    .setIssuer((opts.claims?.iss as string) ?? TEST_ISSUER)
    .setAudience((opts.claims?.aud as string) ?? TEST_PROJECT_ID)
    .setIssuedAt()
    .setExpirationTime((opts.claims?.exp as number) ?? "1h");
  return await jwt.sign(key);
}

/** Authorization header for a minted token. */
export async function testBearer(opts: TestTokenOptions): Promise<Record<string, string>> {
  return { authorization: `Bearer ${await mintTestToken(opts)}` };
}
