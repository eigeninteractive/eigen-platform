/**
 * Default account-deletion instructions.
 *
 * A neutral starting template, NOT legal advice. This page exists to satisfy
 * app-store requirements for a publicly reachable account-deletion route, so
 * keep it reachable without signing in, and keep the email fallback: a user who
 * has already uninstalled the app cannot follow the in-app steps.
 *
 * The steps below match the reference Flutter shell, where "Delete Account" is
 * a standalone tile at the bottom of Settings opening a confirmation dialog. If
 * your app puts it elsewhere, pass your own fragment as
 * `site.legal.deleteAccount` — a wrong path here is an app-store rejection.
 */

import type { LegalProps } from "./props.js";

export function DeleteAccount({ appName, operator }: LegalProps) {
  const mailto = `mailto:${operator.contactEmail}`;
  return (
    <>
      <h1>Delete Your Account</h1>
      <p class="meta">Effective {operator.effectiveDate}</p>

      <p class="lead">You can permanently delete your {appName} account and its associated data at any time, from inside the app.</p>

      <h2>Steps</h2>
      <ol>
        <li>Open {appName} and make sure you are signed in.</li>
        <li>
          Go to <strong>Settings</strong>.
        </li>
        <li>
          Scroll to the bottom and tap <strong>Delete Account</strong>.
        </li>
        <li>Confirm in the dialog that appears.</li>
      </ol>
      <p>Deletion happens immediately and cannot be undone. You will be signed out on every device once it completes.</p>

      <h2>If you no longer have the app</h2>
      <p>
        If you have already uninstalled {appName} and cannot sign in, email <a href={mailto}>{operator.contactEmail}</a> from the address associated with your account, or tell us the display name you used, and we will delete the account for you. We may need to confirm ownership before acting on the request, and we will
        action it as soon as we have.
      </p>

      <h2>What is deleted</h2>
      <ul>
        <li>Your profile, including your display name and profile image.</li>
        <li>Your authentication record, so the account can no longer be signed in to.</li>
        <li>Your device registrations, ending all notifications.</li>
        <li>Your friend connections and any pending requests.</li>
        <li>Your ratings and rating history.</li>
      </ul>

      <h2>What is retained</h2>
      <p>
        Records of completed games are retained in a form that no longer identifies you — your seat shows as a deleted user. Those games are also part of your opponents' history and ratings, so they cannot be removed without altering another player's record. We may also retain limited information where the law requires
        it, or to resolve disputes and prevent abuse.
      </p>

      <h2>Games in progress</h2>
      <p>Deleting your account ends any game you are currently playing. Your opponents are notified that the game will not continue.</p>

      <h2>Questions</h2>
      <p>
        If anything here is unclear, contact {operator.name} at <a href={mailto}>{operator.contactEmail}</a>.
      </p>
    </>
  );
}
