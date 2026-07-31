---
sidebar_position: 5
title: Push notifications (FCM)
description: Native notification channels, FID registration, safe category fallback, and the browser service worker and VAPID path.
---

# Push notifications (FCM)

Push is infra-owned; game code never registers anything. On startup the service:

1. Creates the Android notification channels, so users get per-category
   system-level control:

   | Channel | Importance | iOS level | Sent for |
   |---|---|---|---|
   | `your_turn` | High | `timeSensitive` | A seat newly becomes pending |
   | `game_updates` | Default | `active` | A game becomes ready or finishes |
   | `game_invites` | Default | `active` | A friends-access game is created |
   | `social_notifications` | Low | `active` | Friend request / accepted |
   | `general` | Default | `active` | Unknown or uncategorized messages |

   `your_turn` is also the manifest default channel, so a system-delivered
   background notification with no explicit channel lands somewhere sensible.
2. Enables foreground banners (iOS presentation options +
   `flutter_local_notifications`).
3. Never requests permission during initialization. After a successful
   multiplayer create or join, the waiting room shows a contextual, non-modal
   card explaining why alerts matter and offering **Enable notifications**.
   The OS/browser prompt opens only from that button. There is no separate
   first-visit state or automatic bottom sheet: the platform permission is the
   persisted state. On Android 13+, one local marker disambiguates Firebase's
   `denied` result before and after the app has actually requested permission.
4. Registers the installation with FCM, then reads the **Firebase Installation
   ID (FID)** and registers it with
   **`PUT /api/engine/me/devices { fid, platform }`**. A registration token is
   neither requested nor stored: Firebase's current APIs use `register` and
   target the FID directly. Web uploads the FID from `onRegistered` and removes
   it from `onUnregistered`; native also reconciles on `onIdChange`, sign-in
   and app resume. On web this step runs only after permission is granted and
   passes the required VAPID key.
5. On native platforms, a foreground message shows a local banner — **except**
   a `your_turn` push for the game currently on screen (it reads the router's
   current URI and suppresses a banner for a matching `/game/{id}`). Web does
   not synthesize an OS notification while the page is foregrounded; the open
   app catches up through its API/socket state. Background browser delivery and
   display belong to the service worker.
6. Routes taps via the deep link on the message (`/game/{id}`, `/social`).

**Sign-out** calls `DELETE /api/engine/me/devices/{fid}` (scoped to the caller, so
a device already reassigned to another account is left alone) and clears the local
guard. It deliberately does **not** delete the Firebase installation — that
would reset Crashlytics/Analytics identity — or unregister the installation
from FCM, which would break same-session re-sign-in. Account deletion removes
the device rows server-side.

The **background handler** must be a top-level `@pragma('vm:entry-point')`
function that re-initialises Firebase and does nothing else — the OS renders the
notification from the payload. It is passed into `runEngineApp` by the app,
because it needs the app's own `DefaultFirebaseOptions`. Web background delivery
instead runs in `web/firebase-messaging-sw.js`; the Dart handler is not
registered in a browser.

:::note Unknown categories degrade safely

An unknown or missing `category` falls back to the general notification channel
and is logged. A newer server can therefore add a category without making an
older app discard the notification.

:::

The service worker, VAPID key and production-origin checklist are in
[Deploy the web app](./deploy-the-web-app.md).

Delivery is best-effort and there is no retry — the game state is the truth and
the app catches up on open, so the client must never depend on a push arriving.
The server half is [Push notifications](../how-it-works/notifications.md).

The waiting-room prompt is rendered only for a **seated participant**. Failed
joins, spectators and solo games do not trigger it. If permission is blocked,
later waiting rooms show an inline **Settings** action on native platforms or
browser site-settings guidance on web; the player is not expected to discover
the recovery path unaided.

:::note FlutterFire compatibility seam

Firebase's FID registration APIs landed after the current FlutterFire messaging
surface. Eigen calls the official Web SDK's `register` through an isolated web
adapter and enables Android's native FID auto-registration. Game code never
calls `getToken`, handles `onTokenRefresh`, or stores a registration token.
Remove the adapter when FlutterFire exposes the same APIs; the app/server
contract remains `{ fid, platform }`.

See Firebase's official
[Web registration guide](https://firebase.google.com/docs/cloud-messaging/web/get-started#access_the_firebase_installation_id)
and
[Android FID setup](https://firebase.google.com/docs/cloud-messaging/android/get-started#enable-registration-via-fid).

:::

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
