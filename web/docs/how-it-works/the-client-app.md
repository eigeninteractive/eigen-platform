---
sidebar_position: 12
title: The app shell
description: Package layout, startup order, local persistence, offline UX, navigation, analytics, guests and haptics, all infra-owned.
---

# Package layout

```text
dart/eigen_client/lib/       # pure Dart HTTP, socket, domain, repositories
flutter/lib/
├── eigen_flutter.dart       # game-facing public barrel
├── adapters.dart            # supported integration-provider boundary
├── composition.dart         # embeddable EigenFlutterScope
├── shell_support.dart       # supported boundary consumed by eigen_shell
├── core/                    # Flutter config, ports, storage, game UI contracts
├── features/                # reusable Riverpod/client integration
├── shared/                  # reusable presentation/data glue
└── testing/                 # Dart half of the twin-fixture runner
shell/lib/
├── eigen_shell.dart         # runEigenShell(...)
├── src/app_runner.dart      # startup + MaterialApp.router
├── core/                    # navigation, theme state, updates and review
├── features/                # complete first-party product screens
└── shared/                  # shell-only presentation
firebase/lib/
├── eigen_firebase.dart      # initializeEigenFirebase(...)
└── src/                     # Auth, telemetry, push, and configuration CLI
```

The layering rule is enforced by a test, not convention:
`flutter/test/core/architecture/api_isolation_test.dart` keeps Dio and generated
HTTP capabilities at the transport boundary and rejects every Firebase SDK
import and app-shell dependency from `eigen_flutter`.
`shell/test/architecture_test.dart` proves the full product consumes only the
supported lower-layer barrel and does not reach into `eigen_api` or Firebase.
`firebase/test/architecture_test.dart` separately proves the optional adapter
does not depend on the shell. Generated *models* remain domain vocabulary; the
capability to make a request stays inside `eigen_client`.

A consuming app is a standard Flutter app with the game under `lib/game/`:

```text
my_app/
├── pubspec.yaml             # eigen_flutter + eigen_shell + optional Firebase
├── app-config.json          # public Android + web build-time values
├── lib/
│   ├── main.dart            # ~30-line composition root
│   ├── firebase_options.dart
│   └── game/
│       ├── game_module.dart # versions map + creation/about UI
│       └── v1/              # one folder per schemaVersion
├── test/game/twin_fixtures_test.dart
├── web/
│   ├── firebase-config.js  # generated for the messaging service worker
│   └── firebase-messaging-sw.js
├── android/ ios/ …
├── assets/icon/             # icon.png + icon_foreground.png
└── fastlane/                # Fastfile + Appfile
```

`dart run eigen_firebase:configure_firebase` generates FlutterFire's platform
files and `web/firebase-config.js` from the same selected Firebase app. The
service worker remains app-owned because it runs outside the Dart isolate, but
its identifiers are not hand-maintained.

The `v1/` folder is a **convention, not enforced**. The contract is the
`versions` map. But mirroring the layout across both languages is what makes a
version bump mechanical: a new folder in each tree plus one map entry each.

**Fonts need nothing per app.** The engine bundles Inter as a package font (all
nine weights, declared under `fonts:` in its own pubspec), so Flutter includes it
in every consuming app automatically and it renders offline from the first
frame, with no `google_fonts` and no runtime fetch. To change the typeface, add the new
family's weights to the engine's `fonts/` and update the one constant in
`AppTheme`.

## App startup

`AppStartup` wires the singletons the shell depends on, in a fixed order so no
initial event is missed:

1. Listen to auth state (`listenManual`, before anything can emit).
2. **Register the notification navigation listener *before* calling
   `initialize()`**. The terminated-state tap arrives on a broadcast stream, so
   a listener attached after init misses it.
3. Keep the native splash up until auth resolves; if authenticated, also await
   the profile, **capped at 2 s**. The replica answers immediately once the
   account has synced on this device; a device that has never synced waits for
   the cap, and `FlutterNativeSplash.remove()` still runs in `finally` so the
   home screen opens with a loading profile.
4. An `AppLifecycleListener` reconciles OS/browser notification permission,
   FCM registration and the server's installation row, and polls for an Android
   in-app update on every resume.

On **sign-in** the same handler identifies the user to analytics, tags the
account as guest or registered, and registers this install for push, all
fire-and-forget so none of them delays first paint. Registration is driven by
*auth state* rather than by the notification service's one-time init, because
the row maps a **user** to a device, and an in-session sign-in or account switch
must re-register. Nothing is pre-warmed: the screens read the replica, and
signing in is itself a sync trigger.

Notification initialization **never requests permission**. The first time a
player is successfully seated in a multiplayer waiting room, the shell explains
the concrete value (game ready, turn and result alerts) and exposes an explicit
**Enable notifications** action. That action owns the system/browser prompt.
Choosing **Not now** is respected: future waiting rooms use a quiet inline
action, while Settings remains a secondary fallback. Failed joins, spectators
and solo games never trigger the education sheet. The shell resolves four
permission states:

- **unavailable**: Web Push is unsupported in this browser;
- **promptable**: the player has not made a decision;
- **enabled**: permission and FCM registration can be reconciled;
- **blocked**: open Android system settings, or explain how to use browser site
  settings.

This extra state is necessary on Android 13+, where Firebase reports `denied`
both before the first request and after a denial. One install-local marker
records only a user-initiated system request, so a fresh install still gets an
**Enable** button; another ensures the explanatory modal appears only once.
Blocked native users get an explicit system-Settings action and blocked web
users get browser site-settings guidance. Granted permission calls Firebase's
FID-based `register()` flow and then upserts the installation. FID rotation,
sign-in and app resume all retry that reconciliation; revoking permission
removes the stale server installation row without deleting the Firebase
installation itself.

The splash is **infra-owned**: a game never calls `FlutterNativeSplash.remove()`.

## The device replica

Every screen reads a **replica of the server's read model** on the device, and
nothing else (architecture decision 0013). Opening a screen costs no request,
works offline, and shows the same thing a moment after the app is killed and
reopened. The network is not on the path from a screen to its data:

```text
 writers                                    readers
 sync pass (HTTP)      ─┐
 open game's session   ─┼─► device replica ─► repositories ─► providers ─► screens
 local engine commits  ─┘   (Drift tables)     (live queries)
```

The schema is `eigen_client`'s, in Drift, named after what it mirrors: `games`,
`participants`, `players`, `bots`, `player_ratings`, `rating_history` and
`relationships` from D1; `frames` and, for a game this device decides,
`transitions` from the game's Durable Object; plus `accounts` for where each
account's sync stands. Everything but the public reference data leads its key
with an account id, so one account's replica is exactly its own rows: a second
account on the device never reads them, signing out keeps them, and deleting the
account deletes them.

**One read fills it.** A sync pass uploads the games this device decides
(offline play, below) and then pulls `GET /me/sync`, which answers with the
small sets whole and finished games since a cursor. It runs on events, never on
a timer: app start, resume, reconnecting, pull-to-refresh, a push arriving while
the app is open, and a local game finishing. Only one pass runs at a time, and a
failed one changes nothing, so the replica still holds what the last good one
wrote.

**Writes are ordered by the game's own revision.** A summary from a sync, a
snapshot from the open game's socket and a commit from the local engine all
write the same `games` row; each carries the `seq` its copy was taken at, and an
older one changes nothing. A game this device decides is written by its engine
alone.

Two disciplines make this safe:

- **The replica is a cache of the server, except where it is not.** A game this
  device decides is the only copy of that game until it synchronizes, which is
  why deleting an account deletes it deliberately rather than as cleanup, and
  why a browser is asked for persistent storage when the first one is created.
- **A schema change ships a migration.** The tables are versioned and their
  schema is dumped into `dart/eigen_client/drift_schemas/`, which CI checks;
  there is no "drop it and refetch" path, because some of it cannot be refetched.

Theme choice, notification reconciliation markers and the in-app review counter
are small preferences rather than replicated data, and stay in
`SharedPreferences`.

## Offline play

A [local game](../build-a-game/offline-play.md) is rows in the same tables every
other game is in: its `games` row and seats, plus its log and its one human's
frames. So the lists, history and replay read it exactly as they read a server
game, and nothing merges two sources. A commit is one transaction that appends
the transition and the frame and moves the game's row, which is the Durable
Object's commit and D1's mirror in one step, atomic in a way the server cannot
be.

It renders with no network because everything it needs is already here: its own
rows, plus the players and bots the replica holds, which is what turns a seat
index into a name and an avatar offline. Sync needs no game code and no UI
trigger; it is the upload half of the pass above.

The scaffold's web build ships drift's web runtime (`sqlite3.wasm`,
`drift_worker.js`) and a service worker that precaches the application shell,
registered at the root scope beside the messaging worker's own scope, because
Flutter no longer generates one: without it, a web install has nothing cached to
render from on a cold, offline reload.

## Connectivity & offline UX

Connectivity is infra-owned; game code never watches it. It reports what the
platform says about the network, not whether the internet is reachable, and it
has exactly three jobs: run a sync pass when the device reconnects, drive one
neutral indicator, and disable the actions that need a server. Nothing else
branches on it, because no screen reads the network.

- A **neutral banner** on shell screens when the device reports no network:
  being offline changes where data comes from, not whether the app works.
- A **game played on the server**, offline, shows the board as the replica last
  saw it, says so, and holds its controls still through the same `actionPending`
  state a move in flight uses. A socket failing while the device *does* report a
  network (a blip, or a network with no internet) is the **reconnecting**
  banner instead.
- A **game played on this device** shows neither. Nothing about it needs a
  network, so there is nothing to report.
- The **lobby and friends' open games are not replicated**: a list of games
  joinable right now is wrong the moment it is stale, and joining needs the
  server anyway.

On the offline → online transition the game screen re-subscribes immediately,
bypassing Riverpod's retry backoff.

### What differs on the web

The same code runs, with three differences a browser forces:

- **Storage can be cleared.** Replicated rows come back on the next sync; a
  local game not yet uploaded cannot, so the app asks for persistent storage
  (`navigator.storage.persist()`) when the first one is created.
- **Tabs.** The shell cannot send the cross-origin isolation headers, because
  they break the sign-in popup, so drift's only storage that is safe to share
  between tabs is the shared-worker kind. Where the browser has no shared
  workers, the first tab takes an exclusive lock on the database for its
  lifetime and a second tab says the app is open elsewhere. Sync passes and
  local games also run under browser locks.
- **No storage at all.** A browser that keeps nothing across a reload runs the
  app normally, minus local play, and says so.

## Navigation

A shell with indexed-stack branches, and full-screen routes above it:

```text
/home /lobby /history /social /about /settings   : shell branches (drawer-switched)
/game/:gameId   /join/:code   /profile            : full-screen, above the shell
```

- Branch screens are top-level destinations; Back exits the app (branches switch
  via the drawer, not Back). There is no `PopScope` intercepting it.
- `/game` is always reached by a push, so Back returns to the source screen
  (home/lobby/history) with the predictive-back peek.
- `/join/:code` is a transient spinner that resolves the short code and
  `pushReplacement`s into the game, so Back from the game never lands on a stuck
  spinner. On error it `go`es home, which is safe for both in-app entry and a deep-link
  cold start where no shell is in the stack.
- Deep links (`/join/{code}` from a share, or a push's deep link) route through
  the same join/game paths.

Use `go` for auth redirects and branch roots (replaces the stack), `push` for
anything Back should undo, `pushReplacement` for transient screens.

:::warning[Three things that are easy to delete by accident]

- **`android:enableOnBackInvokedCallback="true"`** in `AndroidManifest.xml` opts
  into the Android 14+ predictive back API. Its absence silently disables
  predictive back for every user on 14+.
- **The `onException` handler** redirects any unmatched or malformed route to
  `/home`. Without it, an iOS Universal Link the OS hands to the app that matches
  no declared route (a `/terms` URL, say) throws a `GoException` that surfaces as
  a crash.
- **`NotificationNavigation.navigateFromNotification`** pushes for overlay
  prefixes (`/game/`, `/join/`) and `go`es for shell branches, mirroring the
  route structure, so Back after a notification tap returns where the user was.
  A new overlay route must be added to its prefix list.

:::

Terms/privacy links open with `LaunchMode.inAppBrowserView` (Safari View
Controller / Custom Tabs) specifically to bypass Universal Links interception.
See [Deep links & domain configuration](../ship-it/deep-links.md).

## Analytics & crash reporting

Both are **adapter-owned**: game rules and widgets never import a Firebase
package or fire provider-specific events. The standard app chooses
`eigen_firebase`; an embedded app can omit it and receives no-op analytics.

`AnalyticsService` is an abstract interface over primitives (`String`, `int`,
`bool`) that never imports `features/` types; call sites convert enums to
strings. The Firebase implementation lives in `eigen_firebase` behind a
keepAlive provider override. Call sites remain provider-neutral and the service
is trivially faked in tests.

When enabled, **Crashlytics** is wired before `runApp`, both arms, so no crash
window exists at startup:

```dart
FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
PlatformDispatcher.instance.onError = (error, stack) {
  FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
  return true;
};
```

`FlutterError.onError` catches framework errors (build failures, assertions);
`PlatformDispatcher.onError` catches isolate-level errors that escape the
framework. **Screen tracking** is a `FirebaseAnalyticsObserver` registered on the
GoRouter instance: one `screen_view` per route transition, no per-screen code.

Events fired automatically: `game_created`, `game_started`, `game_finished`,
`forfeit`, `join_by_code`, `friend_request_sent`, `friend_accepted`. Identity is
`identify` on sign-in / `reset` on sign-out, plus an account-type tag so every
metric segments by guest vs registered.

Two implementation rules that keep these honest:

- **Side effects use `listenManual` in `initState`, never `ref.listen` in
  `build`**, so they don't re-fire on widget rebuilds.
- **Fire only on a *witnessed* transition.** `game_started` requires a previous
  status of `waiting`/`ready`, so opening an already-active game doesn't
  re-count. `game_finished` requires a previous **empty** outcomes list, which
  covers both re-fire paths: reopening a finished game from History (previous is
  null) and an app-resume reload (Riverpod's `AsyncLoading` carries the previous
  non-empty value). The **same guard** gates the win haptic and the in-app review
  counter, so revisiting an old win never inflates either.

Note Firebase Analytics rejects raw `bool` parameters; booleans go as `int` 0/1.

## Guests

Anonymous sign-in gives a real uid and a real (ephemeral) account, so a visitor
can play immediately. Guest capability is deliberately narrowed **server-side**,
and the client's job is only to not offer what will be refused:

- Guests **may** play, including solo vs bots (which comes out unrated). Solo is
  a guest's first-run experience and is *not* gated.
- Guests **may not** create friends-access games, join rated games, or use social
  features at all.
- The Social drawer destination stays **visible but disabled** rather than hidden,
  and `/social` is redirected home in the router as a deep-link backstop. Rated
  lobby games show with a disabled join button. Visible-but-disabled teaches what
  signing up buys; hiding teaches nothing.
- Settings shows a "save your progress" upgrade card, because **inactive guests
  are swept server-side** after a period of inactivity.

**Upgrade preserves the uid.** Native uses `linkWithCredential`; web uses
`linkWithPopup`. Both convert in place, so games, ratings and friendships carry
over with no migration; the provider's display name and avatar overwrite the
guest's while the stable username handle survives. If the chosen account already
belongs to a registered user the link fails, and the app explains that guest
progress cannot be transferred and asks before
switching. Only explicit confirmation signs into the existing account; after
that succeeds, the abandoned guest's disposable local cache is cleared and the
auth-state handler registers the device installation for the destination
account.

A long-dormant guest may have been purged server-side. The client treats "valid
token, empty data" as automatic re-provisioning (the server creates a fresh guest
row on the next request), not an error.

## Haptics, updates & review

**Haptics** are infra-owned: a game never imports `flutter/services.dart` or
picks a feedback style. Three moments fire from the game screen: `lightImpact` on
a submitted action (optimistically, before the request), `heavyImpact` on a win
outcome, and `selectionClick` via the `onInvalidAction` callback the game calls
when `isValidAction` rejects a tap. Centralising the choice is what makes
intensity a single future setting rather than a scattered one.

**In-app updates (Android)** run on resume via Play Core. If an *immediate*
update is allowed and no game is active, the full-screen update runs; if a game is
active it is **skipped and retried next resume**, never silently downgraded to a
flexible update, and never interrupting a game. A *flexible* update downloads in
the background and surfaces a "new version ready, Restart" snackbar. The
mid-game gate reads the current route (`/game/` sits outside the shell navigator,
so a prefix check is reliable). The notifier exposes state rather than showing the
snackbar itself, because it sits above `MaterialApp` and can't resolve a
`ScaffoldMessenger`; the shell scaffold listens and shows it. iOS has no
equivalent; the check returns early.

**In-app review** requests the OS prompt every 5 lifetime wins (persisted in
`SharedPreferences`), fire-and-forget so a slow store round-trip never delays the
outcome UI. The OS enforces its own quota (~3×/year) silently, so no
application-level gate beyond the counter is appropriate. The review dialog
**never appears on simulators or debug builds**. Test through TestFlight or an
internal track.
