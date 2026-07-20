/**
 * Firebase Auth admin — the one privileged auth op the engine performs:
 * deleting a user's Firebase account during account deletion / guest purge
 *. Uses the Identity Toolkit admin REST endpoint with a
 * service-account bearer (scope `identitytoolkit`), reusing the shared
 * `google/oauth` token step.
 *
 * Single attempt: the caller decides what a failure means — the
 * delete-account route aborts before the D1 purge (so the account is never
 * left resurrectable), the cron guest-purge skips the guest and retries next
 * run. Verified against the Identity Platform reference (`accounts:delete`,
 * admin form: `localId` + `targetProjectId`).
 */

import { accessToken, type ServiceAccount } from "../google/oauth.js";

const IDENTITY_TOOLKIT_SCOPE = "https://www.googleapis.com/auth/identitytoolkit";
const DELETE_URL = "https://identitytoolkit.googleapis.com/v1/accounts:delete";

/** Delete the Firebase account for `uid` as an administrator. Resolves on
 * success — and treats "already gone" as success, so a re-run after a partial
 * deletion is idempotent. Throws on any other failure (the caller logs and
 * decides). */
export async function deleteFirebaseAccount(sa: ServiceAccount, uid: string): Promise<void> {
  const bearer = await accessToken(sa, IDENTITY_TOOLKIT_SCOPE);
  const res = await fetch(DELETE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" },
    // The admin form: `localId` is the uid to delete, `targetProjectId` marks
    // this as a privileged admin call (vs a user self-delete, which sends an
    // `idToken`).
    body: JSON.stringify({ localId: uid, targetProjectId: sa.projectId }),
  });
  if (res.ok) {
    await res.body?.cancel();
    return;
  }
  const detail = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  const message = detail.error?.message ?? "";
  // A concurrent/earlier delete already removed the account — the goal state.
  if (message === "USER_NOT_FOUND") return;
  throw new Error(`Firebase account delete failed for ${uid}: HTTP ${res.status} ${message}`);
}
