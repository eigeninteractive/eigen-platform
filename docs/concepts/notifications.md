---
sidebar_position: 10
title: Push notifications
description: Best-effort turn and finish pushes via FCM HTTP v1, addressed to Firebase Installation IDs.
---

# Push notifications

The engine sends best-effort "your turn" and "game over" pushes via FCM HTTP v1.
It is entirely opt-in: with no Firebase service-account configured, the whole
path is skipped.

- **Auth**: a service-account JWT (signed with jose, RS256) is exchanged at
  Google's token endpoint for an OAuth bearer, cached per (account, scope) in
  isolate memory. The same token step serves FCM and the admin account-delete.
- **Targets**: pushes are addressed to a user's **device installations** — one
  row per install, keyed by Firebase Installation ID (FID). Clients register via
  `PUT /api/engine/me/devices { fid, platform }` (upsert-on-FID, so signing in
  reassigns a device) and deregister on sign-out via
  `DELETE /api/engine/me/devices/{fid}` (scoped to the caller). Without a
  registration, a user has no targets and simply receives nothing.
- **Delivery**: on a turn/finish transition the kernel emits `notify_turn` /
  `notify_finished` effects; the DO delivers them post-commit, single-attempt.
  A send that reports a permanently dead installation prunes that row; transient
  failures are left for the next send. There is no retry machinery — the game
  state is the truth and the app catches up on open.

The client side of this — requesting permission, registering the FID, and
handling a tapped notification — is covered in
[Push notifications (client)](../client/push.md).
