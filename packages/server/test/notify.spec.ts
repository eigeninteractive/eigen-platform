/**
 * FCM configuration seam: `readServiceAccount` reads the service account
 * from env by the `FIREBASE_*` convention and is null (push skipped) unless
 * all three vars are present. The network send path needs real Google
 * credentials and is exercised in production, not here.
 */

import { describe, expect, it } from "vitest";
import { readServiceAccount } from "../src/notify/fcm.js";

describe("readServiceAccount", () => {
  it("returns null when any FIREBASE_* var is missing or empty", () => {
    expect(readServiceAccount({})).toBeNull();
    expect(readServiceAccount({ FIREBASE_PROJECT_ID: "p", FIREBASE_CLIENT_EMAIL: "e@x" })).toBeNull();
    expect(readServiceAccount({ FIREBASE_PROJECT_ID: "p", FIREBASE_CLIENT_EMAIL: "e@x", FIREBASE_PRIVATE_KEY: "" })).toBeNull();
  });

  it("reads the account and un-escapes newlines in the PEM key", () => {
    const sa = readServiceAccount({
      FIREBASE_PROJECT_ID: "proj",
      FIREBASE_CLIENT_EMAIL: "svc@proj.iam",
      FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nMIIB\\n-----END PRIVATE KEY-----\\n",
    });
    expect(sa).not.toBeNull();
    expect(sa?.projectId).toBe("proj");
    expect(sa?.privateKey).toBe("-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----\n");
  });
});
