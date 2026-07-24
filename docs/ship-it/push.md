---
sidebar_position: 5
title: Push notifications (FCM)
description: Three notification channels, FID registration, the strict category field, and the monochrome Android icon nobody generates for you.
---

# Push notifications (FCM)

Push is infra-owned; game code never registers anything. On startup the service:

1. Creates the Android notification channels — three, so users get per-category
   system-level control:

   | Channel | Importance | iOS level | Sent for |
   |---|---|---|---|
   | `your_turn` | High | `timeSensitive` | A seat newly becomes pending |
   | `game_invites` | Default | `active` | A friends-access game is created |
   | `social_notifications` | Low | `active` | Friend request / accepted |

   `your_turn` is also the manifest default channel, so a system-delivered
   background notification with no explicit channel lands somewhere sensible.
2. Enables foreground banners (iOS presentation options +
   `flutter_local_notifications`).
3. Requests OS permission once, gated by a persisted first-launch flag.
4. Forces FCM registration with `getToken` (passing `vapidKey` on web), then reads
   the **Firebase Installation ID (FID)** and registers it with
   **`PUT /api/engine/me/devices { fid, platform }`**. The token result is
   discarded — the FID is the stored identity, because FCM v1 deprecated the
   registration-token target. It re-registers on `onIdChange`.
5. On a foreground message, shows a local banner — **except** a `your_turn` push
   for the game currently on screen (it reads the router's current URI and
   suppresses a banner for a matching `/game/{id}`). Background delivery is
   unaffected; the OS renders those directly.
6. Routes taps via the deep link on the message (`/game/{id}`, `/social`).

**Sign-out** calls `DELETE /api/engine/me/devices/{fid}` (scoped to the caller, so
a device already reassigned to another account is left alone) and clears the local
guard. It deliberately does **not** delete the Firebase installation — that would
reset Crashlytics/Analytics identity — and does not drop the FCM registration,
which wouldn't re-establish until the next process start and would break
same-session re-sign-in. Account deletion removes the device rows server-side.

The **background handler** must be a top-level `@pragma('vm:entry-point')`
function that re-initialises Firebase and does nothing else — the OS renders the
notification from the payload. It is passed into `runEngineApp` by the app,
because it needs the app's own `DefaultFirebaseOptions`.

:::warning The category field is strict on purpose

An unknown or missing `category` in the data payload throws rather than falling
back to a default channel: a silent fallback would hide a misconfigured
server-side send until a user reported missing notifications.

:::

Delivery is best-effort and there is no retry — the game state is the truth and
the app catches up on open, so the client must never depend on a push arriving.
The server half is [Push notifications](../how-it-works/notifications.md).

## The Android notification icon

Android API 21+ ignores colour in notification icons — it composites the alpha
channel against its own tint. Using the full-colour launcher icon renders a solid
white box. The correct asset is a **monochrome silhouette vector drawable** at
`android/app/src/main/res/drawable/ic_notification.xml`, referenced in three
places: the manifest's `default_notification_icon` meta-data (background and
terminated delivery), `AndroidInitializationSettings` (foreground banners), and
`AndroidNotificationDetails(icon:)` (per-notification, for consistency).

It is a `<vector>`, so no per-density variants are needed — and
`flutter_launcher_icons` does **not** generate it. This is a one-time,
hand-maintained, **per-app** asset: replace it when the app rebrands.
