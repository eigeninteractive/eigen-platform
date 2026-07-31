---
sidebar_position: 12
title: The app shell
description: Package layout, startup order, local persistence, offline UX, navigation, analytics, guests and haptics — all infra-owned.
---

# Package layout

```text
eigen-flutter/
└── lib/
    ├── eigen_flutter.dart   # the public barrel
    ├── app_runner.dart      # runEngineApp(...) — the entry point
    ├── src/api/
    │   ├── generated/       # GENERATED REST client — never hand-edited
    │   └── generated_from.dart  # which engine build produced it
    ├── core/
    │   ├── api/             # Dio + auth interceptor, engineCall, the socket,
    │   │                    #   ServerClock, avatar-URL resolution
    │   ├── config/          # AppConfig (Branding + EngineConfig)
    │   ├── game/            # the game contract: GameModule, GameRules,
    │   │                    #   GameFrame, PlayersContext, TimingContext,
    │   │                    #   MySeat, GameCreationSpec, timing constants
    │   ├── analytics/ notifications/ updates/ review/ connectivity/
    │   ├── storage/ theme/ navigation/ errors/ utils/ startup/
    ├── features/            # about auth game home profile rating settings social
    │   └── <feature>/{data,providers,presentation}
    ├── shared/{data,providers,widgets}
    └── testing/             # the Dart half of the twin-fixture runner
```

The layering rule is enforced by a test, not convention:
`test/core/architecture/api_isolation_test.dart` restricts `package:dio` and the
six generated `*Api` classes to `core/api/`, the feature `data/` layers, and
`shared/data/`. Generated *models* may be used anywhere — they are the domain
vocabulary. What is confined is the **capability to make a request**, not the
types that come back. That test is what made folding transport into this package
safe after the separate pure-Dart package was dropped.

A consuming app is a standard Flutter app with the game under `lib/game/`:

```text
my_app/
├── pubspec.yaml             # depends on eigen_flutter (path, until published)
├── app-config.json          # public Android + web build-time values
├── lib/
│   ├── main.dart            # ~30-line entry: runEngineApp(module, config, …)
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

`dart run eigen_flutter:configure_firebase` generates FlutterFire's platform
files and `web/firebase-config.js` from the same selected Firebase app. The
service worker remains app-owned because it runs outside the Dart isolate, but
its identifiers are not hand-maintained.

The `v1/` folder is a **convention, not enforced** — the contract is the
`versions` map. But mirroring the layout across both languages is what makes a
version bump mechanical: a new folder in each tree plus one map entry each.

**Fonts need nothing per app.** The engine bundles Inter as a package font (all
nine weights, declared under `fonts:` in its own pubspec), so Flutter includes it
in every consuming app automatically and it renders offline from the first frame
— no `google_fonts`, no runtime fetch. To change the typeface, add the new
family's weights to the engine's `fonts/` and update the one constant in
`AppTheme`.

## App startup

`AppStartup` wires the singletons the shell depends on, in a fixed order so no
initial event is missed:

1. Listen to auth state (`listenManual`, before anything can emit).
2. **Register the notification navigation listener *before* calling
   `initialize()`** — the terminated-state tap arrives on a broadcast stream, so
   a listener attached after init misses it.
3. Keep the native splash up until auth resolves; if authenticated, also await
   the profile warm-up, **capped at 2 s**. A native SQLite cache normally
   resolves immediately; web fetches the profile again after reload. If neither
   finishes within the cap, `FlutterNativeSplash.remove()` still runs in
   `finally` and the home screen opens with a loading profile.
4. An `AppLifecycleListener` reconciles OS/browser notification permission,
   FCM registration and the server's installation row, and polls for an Android
   in-app update on every resume.

On **sign-in** the same handler does four things, all fire-and-forget so none of
them delays first paint: identify the user to analytics, tag the account as guest
or registered, register this install for push, and pre-warm the profile and bot
catalog. Registration is driven by *auth state* rather than by the notification
service's one-time init, because the row maps a **user** to a device — an
in-session sign-in or account switch must re-register.

Notification initialization **never requests permission**. The first time a
player is successfully seated in a multiplayer waiting room, the shell explains
the concrete value (game ready, turn and result alerts) and exposes an explicit
**Enable notifications** action. That action owns the system/browser prompt.
Choosing **Not now** is respected: future waiting rooms use a quiet inline
action, while Settings remains a secondary fallback. Failed joins, spectators
and solo games never trigger the education sheet. The shell resolves four
permission states:

- **unavailable** — Web Push is unsupported in this browser;
- **promptable** — the player has not made a decision;
- **enabled** — permission and FCM registration can be reconciled;
- **blocked** — open Android system settings, or explain how to use browser site
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

## Local persistence

**Native goal:** eliminate cold-start spinners for data that is already known
and rarely changes. Web deliberately starts with a fresh server read after each
reload and relies on Riverpod's in-memory state for the browser session.

Native apps currently store selected provider state as JSON with Riverpod's
official SQLite adapter (`riverpod.db`, via `riverpod_sqflite`). Persisted
providers **race** their restore against the network fetch rather than
sequencing them: `persist()` is called *without* awaiting, and an internal
`didChange` guard stops a slow cache read from overwriting a fresher network
result.

| Provider | Native across launches | Web after reload |
|---|---|---|
| current user profile | SQLite stale-while-revalidate | fetch |
| player-info cache (per id) | SQLite, 30-day expiry | fetch through the batch endpoint |
| friends | SQLite stale-while-revalidate | fetch |
| bot catalog | SQLite, 7-day expiry | fetch |
| ratings, active games | fetch | fetch |

Two disciplines make this safe:

- **`destroyKey` is per provider, not global.** Bump the individual provider's
  key when *its* model's persisted shape changes incompatibly; old entries are
  discarded and refetched. Sharing one key would mean a profile change wipes the
  friends cache. There is no incremental JSON migration — this is the only path.
- **Clear native user caches on sign-out and account deletion.**
  `deleteUserData(uid)` wipes every
  user-scoped key (`profile_{uid}`, `friends_{uid}`, …) and must run **before**
  the auth session ends, since after deletion the credentials are gone. Cache
  entries also carry an expiry. The **player-info cache is deliberately not
  cleared** — player identity is public, and a second account on the same device
  benefits from it — but each entry expires after 30 days.

The keys live in one place (`core/storage/`) rather than beside their providers,
which also breaks a circular import between auth and profile.

Theme choice and notification reconciliation markers are small preferences, not
server-response caches, and continue to use `SharedPreferencesAsync` on web.
Firebase owns authentication persistence independently. When native adopts
Drift for queryable data such as game history, these JSON snapshots should move
behind repositories as typed tables rather than turning Drift into another
generic Riverpod key-value backend.

## Connectivity & offline UX

Connectivity is infra-owned — game code never watches it. Two banners, both built
on `StatusBanner`, both animating their height so the layout slides rather than
jumps, and both pushing content down rather than overlaying it:

- An **offline banner** on shell screens when the device reports no network.
- A **reconnecting banner** on the game screen when offline *or* the game
  stream/observation is erroring *and* the game is non-terminal. It lives in its
  own leaf `ConsumerWidget` so a connection blip rebuilds the banner, not the
  whole game tree.

Two subtleties worth keeping:

- **Interface availability is not internet reachability.** `connectivity_plus`
  reports "online" on a captive Wi-Fi with no upstream. So the error arm matters
  as much as the offline arm, and the real recovery signal is the stream
  re-syncing, not the connectivity flag.
- **Stale data beats an error screen.** The game screen renders from
  `asyncValue.value` whenever it is non-null — which covers `AsyncError` carrying
  a previous value — so the board stays visible while the banner communicates the
  reconnecting state. The hard error state only appears on a cold-start failure
  with no data ever received.

On the offline → online transition the game screen invalidates its providers
immediately, bypassing Riverpod's retry backoff.

## Navigation

A shell with indexed-stack branches, and full-screen routes above it:

```text
/home /lobby /history /social /about /settings   — shell branches (drawer-switched)
/game/:gameId   /join/:code   /profile            — full-screen, above the shell
```

- Branch screens are top-level destinations; Back exits the app (branches switch
  via the drawer, not Back). There is no `PopScope` intercepting it.
- `/game` is always reached by a push, so Back returns to the source screen
  (home/lobby/history) with the predictive-back peek.
- `/join/:code` is a transient spinner that resolves the short code and
  `pushReplacement`s into the game, so Back from the game never lands on a stuck
  spinner. On error it `go`es home — safe for both in-app entry and a deep-link
  cold start where no shell is in the stack.
- Deep links (`/join/{code}` from a share, or a push's deep link) route through
  the same join/game paths.

Use `go` for auth redirects and branch roots (replaces the stack), `push` for
anything Back should undo, `pushReplacement` for transient screens.

:::warning Three things that are easy to delete by accident

- **`android:enableOnBackInvokedCallback="true"`** in `AndroidManifest.xml` opts
  into the Android 14+ predictive back API. Its absence silently disables
  predictive back for every user on 14+.
- **The `onException` handler** redirects any unmatched or malformed route to
  `/home`. Without it, an iOS Universal Link the OS hands to the app that matches
  no declared route (a `/terms` URL, say) throws a `GoException` that surfaces as
  a crash.
- **`NotificationNavigation.navigateFromNotification`** pushes for overlay
  prefixes (`/game/`, `/join/`) and `go`es for shell branches — mirroring the
  route structure, so Back after a notification tap returns where the user was.
  A new overlay route must be added to its prefix list.

:::

Terms/privacy links open with `LaunchMode.inAppBrowserView` (Safari View
Controller / Custom Tabs) specifically to bypass Universal Links interception —
see [Deep links & domain configuration](../ship-it/deep-links.md).

## Analytics & crash reporting

Both are **infra-owned** — a game never imports a Firebase package or fires an
event. Firebase itself is mandatory: `runEngineApp` initialises it before
anything else, so every deployment runs it.

`AnalyticsService` is an abstract interface over primitives (`String`, `int`,
`bool`) that never imports `features/` types — call sites convert enums to
strings. The Firebase implementation sits behind a keepAlive provider. The point
of the interface is not swappability (there will only ever be Firebase); it is
that call sites don't depend on Firebase and the service is trivially faked in
tests.

**Crashlytics** is wired before `runApp`, both arms, so no crash window exists at
startup:

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
GoRouter instance — one `screen_view` per route transition, no per-screen code.

Events fired automatically: `game_created`, `game_started`, `game_finished`,
`forfeit`, `join_by_code`, `friend_request_sent`, `friend_accepted`. Identity is
`identify` on sign-in / `reset` on sign-out, plus an account-type tag so every
metric segments by guest vs registered.

Two implementation rules that keep these honest:

- **Side effects use `listenManual` in `initState`, never `ref.listen` in
  `build`** — so they don't re-fire on widget rebuilds.
- **Fire only on a *witnessed* transition.** `game_started` requires a previous
  status of `waiting`/`ready`, so opening an already-active game doesn't
  re-count. `game_finished` requires a previous **empty** outcomes list, which
  covers both re-fire paths: reopening a finished game from History (previous is
  null) and an app-resume reload (Riverpod's `AsyncLoading` carries the previous
  non-empty value). The **same guard** gates the win haptic and the in-app review
  counter, so revisiting an old win never inflates either.

Note Firebase Analytics rejects raw `bool` parameters — booleans go as `int` 0/1.

## Guests

Anonymous sign-in gives a real uid and a real (ephemeral) account, so a visitor
can play immediately. Guest capability is deliberately narrowed **server-side** —
the client's job is only to not offer what will be refused:

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

**Haptics** are infra-owned — a game never imports `flutter/services.dart` or
picks a feedback style. Three moments fire from the game screen: `lightImpact` on
a submitted action (optimistically, before the request), `heavyImpact` on a win
outcome, and `selectionClick` via the `onInvalidAction` callback the game calls
when `isValidAction` rejects a tap. Centralising the choice is what makes
intensity a single future setting rather than a scattered one.

**In-app updates (Android)** run on resume via Play Core. If an *immediate*
update is allowed and no game is active, the full-screen update runs; if a game is
active it is **skipped and retried next resume** — never silently downgraded to a
flexible update, and never interrupting a game. A *flexible* update downloads in
the background and surfaces a "new version ready — Restart" snackbar. The
mid-game gate reads the current route (`/game/` sits outside the shell navigator,
so a prefix check is reliable). The notifier exposes state rather than showing the
snackbar itself, because it sits above `MaterialApp` and can't resolve a
`ScaffoldMessenger` — the shell scaffold listens and shows it. iOS has no
equivalent; the check returns early.

**In-app review** requests the OS prompt every 5 lifetime wins (persisted in
`SharedPreferences`), fire-and-forget so a slow store round-trip never delays the
outcome UI. The OS enforces its own quota (~3×/year) silently, so no
application-level gate beyond the counter is appropriate. The review dialog
**never appears on simulators or debug builds** — test through TestFlight or an
internal track.
