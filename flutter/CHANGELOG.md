# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries are maintained with [`cider`](https://pub.dev/packages/cider); add them
as you work (`cider log added "…"`), and `cider release` moves everything under
`## [Unreleased]` into a dated section at release time.

Pre-1.0, breaking changes land in a **MINOR** bump: `^0.1.0` resolves to
`>=0.1.0 <0.2.0`. See
[Versions and compatibility](https://eigeninteractive.com/docs/reference/compatibility)
for how this package, the engine and the generated `eigen_api` client pair up.

## [Unreleased]
### Added
- A provider-neutral `AuthGateway`, auth identity model, and upgrade result are
  now public so authentication adapters can live outside `eigen_flutter`
  without exposing Firebase credential types to presentation code.
- The protocol-facing domain model, authenticated transport seams, server
  clock, and live socket now live in the independent pure-Dart `eigen_client`
  package. `eigen_flutter` re-exports that surface for game apps.
- WebSocket connections authenticate with a fresh, short-lived, game-scoped
  ticket obtained over authenticated HTTPS. Firebase ID tokens no longer appear
  in WebSocket URLs.
- Game versions declare contiguous support from version 1 through
  `latestSchemaVersion`, so create and join compatibility have one simple rule.

### Changed
- Creation sends the client's latest bundled game version and treats an older
  client as an update-required blocker. The server always creates the latest
  installed game version; the capabilities endpoint and sparse-version
  negotiation are gone.
- Mutations are sent once and ambiguous transport failures resynchronize from
  authoritative state. The generic command ID, durable receipt protocol, and
  mutation retry path are removed.
- Contract payload generation moved to the development-only `eigen_codegen`
  package. It enforces the portable schema profile and rejects unsupported
  constraints instead of silently generating weaker Dart validation.
- Timing and seat choices remain mirrored for immediate UI feedback, but the
  TypeScript rules are authoritative and the server rejects disagreement.

## [0.7.0] - 2026-08-19
### Added
- `newCommandId()`, the mutation identity generator, and handling for the
`commandConflict` and `idempotencyKeyInvalid` server codes. Both report the
generic failure message on purpose: each means this app built a bad request, so
no player action causes or repairs one.

### Changed
- Every game mutation now sends the standard `Idempotency-Key` header, minted per
call as a UUIDv7. Repository methods still accept an optional `commandId` to
reuse a key deliberately, which is how a retry replays a committed result instead
of applying a move twice. The engine requires the header, so this pairs with an
engine that sends it; see
[Versions and compatibility](https://eigeninteractive.com/docs/reference/compatibility).
- Join now sends `GameModule.supportedSchemaVersions`, the full set of versions
this build ships, instead of only the newest. `versions` is sparse, so a maximum
claimed support for gaps: a `{1, 3}` build could be seated into a v2 game it
cannot decode. Pairs with an engine that checks exact membership.
- `retryTransientGet` is now `retryTransient`, and it retries a *keyed mutation*
whose failure carried no response, not only a GET. Dio replays the original
request, so the retry carries the same `Idempotency-Key` and the engine answers
from its committed receipt rather than applying the command twice. A mutation
without a key is still never retried, because its outcome after a timeout is
genuinely unknown.
- **Breaking.** `GameRules` gains a required `playerLimits(config)` returning
`PlayerLimits`: the seats one config may be played with, and the twin of the
server hook of the same name. `GameCreationSpec.minPlayers`/`maxPlayers` are gone,
because they duplicated it unversioned; `GameModule.playersForConfig` now
delegates to the latest version's twin, so most modules stop overriding it.
Creation sends the range as an assertion and **the engine refuses one it cannot
seat**, so unlike `ratingPool`/`botSeatable` this twin is enforced: drift fails a
create rather than mis-rendering a control. Narrowing the range is still allowed.
- Twin fixtures accept a `playerLimits` case kind, so a drifted seat declaration
fails a test on both sides.
- `eigen_api` pin raised to `^0.5.0`. The engine's 0.5 wire contract renames
`clientSchemaVersion` to `clientSchemaVersions` and requires `Idempotency-Key` on
every mutation, so a shell speaking 0.4.x cannot talk to it and this package
cannot be built against the 0.4.x client.
- Package source, issue, changelog, and release links now point at the unified
`eigen-platform` repository. Future releases use namespaced
`eigen_flutter-vX.Y.Z` tags so they cannot collide with other platform
artifacts.

### Fixed
- A delayed active snapshot with a higher sequence can no longer resurrect a
finished or aborted game. Newer terminal snapshots still apply so post-finish
data such as ratings can arrive normally.
- Gap recovery now verifies that every requested frame is present and ordered
before applying any of them, so an incomplete history response cannot advance
the rendered session through a corrupt sequence.
- Action and forfeit controls no longer stay disabled if the caller's seat
disappears immediately before the command is sent.

## [0.6.0] - 2026-08-12
### Added
- Copy for the engine's new invalidCursor code. A cursor is echoed, never composed, so a user can neither cause nor fix one; it means the list needs restarting from the top, which is what a refresh does.

### Changed
- Paged lists follow the engine's opaque cursors. getLobby, getMyGames, getPlayerGames and getFriendsGames return a GamesPage record carrying the page and the server's nextCursor, instead of a bare list. That removes two things the client had no business knowing: the sort order, which history\_screen reconstructed from the last row's finishedAt ?? updatedAt, a hand-maintained copy of a rule the server owns; and where the list ends, which was inferred from a page coming back shorter than the page size. That inference is wrong exactly when the final page is full, and costs the reader a spinner and a request that returns nothing. nextCursor is null when the list is exhausted, so it is an answer rather than a guess.
- eigen\_api pin raised to ^0.4.0: the engine now returns nextCursor on every paged response and takes cursor as an opaque string, and a shell speaking 0.3.x cannot read it.

### Fixed
- Refreshing a paged list no longer pages on from a stale cursor. The cursor lives beside the paging controller, so the two have to be reset together; refreshing without clearing it refetched page one and then continued from wherever the last scroll had reached. Both screens now route every refresh through one \_refresh(), which matters because history has three refresh affordances and the lobby has five (toolbar, pull-to-refresh, error retry, and on the lobby a game being joined or cancelled).

## [0.5.0] - 2026-08-12
## [0.4.1] - 2026-08-12
### Added
- EngineConfig.authDomain overrides Firebase Auth's domain, so web sign-in can name your own host instead of the project's firebaseapp.com. Optional and cosmetic: unset, which is the scaffolded value, keeps the project default, and Android never shows it. It is not APP\_HOST; the value must be a Firebase Hosting domain. Applied to the generated FirebaseOptions at startup, so configure\_firebase can keep regenerating firebase\_options.dart.

## [0.4.0] - 2026-08-11
### Added
- GameContentContext.transition gives a game the step into the current frame (from, to), or null when there is nothing to animate: a cold load, a rejoin, or the opening frame. Animate only when it is non-null, which replaces tracking the last rendered version in widget state. Replay supplies it too, so one animation path serves live play and replay.

### Changed
- The game screen renders from one live session instead of assembling one from four sources. gameSessionProvider is the single subscription, and status, roster, frame, outcomes and the wire-compatibility verdict are all pure selectors over it; no game screen reads gameSummaryProvider any more, which stays what it always was, the index behind lists. This fixes a creator's waiting room never offering Start once the roster filled, every seat staying in the waiting room after the game began, and a socket reconnect replacing the board with a spinner until somebody moved.
- eigen\_api pin raised to ^0.3.0: the engine's session-snapshot wire is a new release line, and a shell speaking 0.2.x cannot read it.

### Removed
- Roster, Joined and LobbyAccepted are gone from the wire, along with the roster, sync and frame socket message kinds. The socket carries one message, a complete per-seat session snapshot, and every accepted command answers with the same value. A list screen must never subscribe to a session; the home card now resolves its avatars from the index row, as the lobby card already did, instead of opening one socket per row.

## [0.3.7] - 2026-08-09
### Added
- `configure_firebase` now fills in the deployment values that exist only once a Firebase project does: `GOOGLE_WEB_CLIENT_ID` in `app-config.json`, from the OAuth client Firebase created, and with the new `--worker <dir>` flag, `FIREBASE_PROJECT_ID` in the Cloudflare Worker's `wrangler.jsonc`. The Worker edit rewrites one assignment in place, so that file's comments survive, and refuses when the key does not appear exactly once. An app-only repository omits the flag and keeps the app half.

### Changed
- The `firebase` CLI is now suggested as `curl -sL https://firebase.tools | bash` rather than `npm install -g firebase-tools`, matching the installer the Firebase documentation leads with.

## [0.3.6] - 2026-08-08
### Changed
- Em dashes are gone from every line this package writes, including the strings a player reads: 'The game updated. Try again.', the notification-permission rows in settings, and the in-progress replay notice. Comments, docs, the example game, the workflows and the changelog itself went with them.

## [0.3.5] - 2026-08-07
### Changed
- `configure_firebase` checks that a Google account is signed in to the Firebase CLI before it starts, and names `firebase login` when none is. Those are the credentials both CLIs share, and previously the one preflight failure FlutterFire was left to discover for itself. The check fails open: only an answer that positively reports no accounts stops the run.
- A successful run names the Firebase project and the Android and Web app IDs it configured against. FlutterFire matches an existing Android app on the package name and an existing Web app on its display name, and reuses either without comment, so adopting the apps a project already had looked identical to registering new ones, and now does not.
- The Web SDK configuration is downloaded quietly. It is an intermediate (read, checked, rewritten as `web/firebase-config.js`, then deleted) so the Firebase CLI's own success line announced a temporary file that no longer existed by the time anyone read it. A failing download still prints everything it said.

## [0.3.4] - 2026-08-07
### Changed
- The credit line defaults to `Built with EigenInteractive`, matching the game's own website, and renders as prose with only the brand name linked, accent-coloured and without an underline. A `Branding.madeByCredit` that never names the engine stays plain text. The settings and about screens now share one `MadeByCredit` widget instead of the same footer written twice.

### Fixed
- `configure_firebase` no longer fails with `FirebaseProjectRequiredException` on a first run: `--yes` is only passed once the Firebase project is settled, so an unconfigured run gets FlutterFire's project picker, where a project can also be created, instead of a hard stop. The project can be named with `--project <id>`, and is otherwise read back from the `firebase.json` a previous run wrote or a `.firebaserc`, so re-runs stay non-interactive. `--account <email>` is accepted for a machine signed in to several Google accounts, `--help` prints the usage, and a bare `--` is ignored so `run firebase:configure -- --project x` works under both npm and pnpm. Every other option is refused with a usage error rather than passed to FlutterFire: platforms in particular are fixed at Android and Web, which are the platforms the app has and where the messaging service worker's configuration comes from.

## [0.3.3] - 2026-08-07
### Changed
- Bundle Inter and Space Grotesk as single variable files instead of nine static Inter weights, and pair them across the Material 3 text roles: Space Grotesk on display and headline, Inter on everything read at length. `Branding.displayFontFamily` overrides the display face and `Branding.seedColor` now defaults to the EigenInteractive teal, so a game looks deliberate before anyone has configured it and is one line to rebrand. Font payload drops from 2.7 MB to under 1 MB while gaining a family, because `FontWeight` has driven the `wght` axis since Flutter 3.41 and this package requires 3.44. `tool/download_fonts.sh`, which fetched static weights from gstatic by content hash, is gone.

## [0.3.2] - 2026-08-07
### Changed
- `configure_firebase` checks for `flutterfire` and `firebase` before it starts, and names the one that is missing with the command that installs it. It previously pointed at both CLIs without saying how to get either, and only after FlutterFire had already written its files.

## [0.3.1] - 2026-08-06
### Changed
- Use **EigenInteractive** as the product name in the package description, README, dartdoc and the default `madeByCredit` credit line. No API changes; the generated payload header comment now reads `Generated from the game-owned EigenInteractive contract.`, so a game running `generate_payloads --check` needs one regeneration.

## [0.3.0] - 2026-08-05
### Changed
- **Breaking for apps that customised the Firebase notification meta-data.**
The manifest merger treats two `<meta-data>` entries with the same
`android:name` and different `android:value` as a conflict and fails the build.
An app that declares
`com.google.firebase.messaging.default_notification_channel_id` or
`default_notification_icon` with a value other than `your_turn` /
`@drawable/ic_notification` must now either drop its copy, since this package
supplies both, or keep it and add
`tools:replace="android:value"` (or `android:resource`) to that element.
Declaring the same values as this package needs no change.

### Fixed
- Notifications no longer need a hand-created icon. This package referenced
`@drawable/ic_notification` from its Dart while its Android plugin shipped no
resources at all, so the icon only resolved in apps that happened to create that
drawable themselves. The plugin now ships it, together with the Firebase
default-channel and default-notification-icon meta-data. An app overrides the
silhouette by declaring the same resource name; Android resource merging gives
the application module precedence over a library.

## [0.2.0] - 2026-08-03
### Changed
- `eigen_api` moved to `^0.2.0`, following the engine to its 0.2.x release line.
No Dart API changed. The 0.2.0 spec is byte-identical to 0.1.0's apart from
the version stamp, and 0.2.0 of the engine was a TypeScript-side cleanup, but
a consumer cannot depend on this package and `eigen_api 0.2.0` at the same
time until this ships, so it is a breaking change to the constraint rather
than a patch.

## [0.1.0] - 2026-08-02
Initial release. The entries below describe the starting state rather than
changes from a previous version.

### Added
- `configure_firebase`, which runs FlutterFire and generates the messaging
service worker's public Web configuration from the selected Firebase app.
- `runEngineApp(...)` entry point, with `AppConfig` / `EngineConfig` / `Branding`
as the composition-root config. The framework reads every runtime value from
`EngineConfig` and never from the app's `Env`, so this package needs no
Firebase project or `.env` of its own.
- `Branding.madeByCredit`, so the settings footer credit is configurable.
- The `GameModule` / `GameRules` contract: a game supplies one rules unit per
`schemaVersion`, and the framework dispatches on the version a game was
created at.
- Client-side optimistic preview (`previewAction`) and cue-aware rendering
against the engine's append-only observation history.
- Generated wire enums preserve values introduced by a newer server as an
`unknownDefaultOpenApi` sentinel instead of failing response decoding. Known
values retain their specific UI; unknown values degrade to generic UI when
safe, while gameplay-critical values block only the affected surface and
offer a native Play update on Android or a browser reload on web.
- Firebase auth (Google + guest), FCM push, Crashlytics and Analytics wiring.
Auth and notification capability share one required Firebase project; the
player permission prompt remains an explicit opt-in and delivery remains
best-effort.
- Avatar upload and display against the worker-served avatar URL, via
`cached_network_image`.
- Rock–Paper–Scissors under `example/`: a complete game, and the worked answer
to "how do I test a game screen". Its `fixtures/v1/rps.json` is the Dart half
of a twin-fixture contract the engine repo checks from the other side.
- **Inter** bundled as a package font (all 9 weights under `fonts:`), so
consuming apps get it automatically and it renders offline from the first
frame. `AppTheme` references `packages/eigen_flutter/Inter`.

### Changed
- Public app deployment values now use Dart compilation environment
declarations and one cross-platform `app-config.json`; startup reports
missing or malformed required values before initializing engine services.
- Persisted Riverpod API snapshots are native-only. Web keeps provider data for
the browser session and refetches after reload, while preferences, Firebase
Auth, and notification bookkeeping retain their own browser persistence.
- FCM registration now uses Firebase Installation IDs end-to-end. Web calls
Firebase's current `register` API through a narrow compatibility adapter;
Android uses native FID auto-registration configured by the package's Android
plugin, so consuming apps do not edit their generated manifest or Gradle
properties. The app no longer requests, refreshes, or persists deprecated
registration tokens.
- Notification opt-in is a contextual non-modal card for seated multiplayer
players. The platform permission state drives the UI directly; blocked users
get an explicit Settings recovery path.
- **The backend is the Eigen engine on Cloudflare Workers, not Supabase.** The
data layer talks to the Worker over REST and WebSocket; the transport half is
the generated `eigen_api` client, published from the engine repo at the
engine's own version and consumed here as an ordinary versioned dependency.
There is no vendored OpenAPI spec and no local codegen for it.
- Riverpod toolchain moved to the 3.3.2 line (`flutter_riverpod ^3.3.2`,
`riverpod_annotation ^4.0.3`, `riverpod_generator ^4.0.4`, `riverpod_lint ^3.1.4`, `riverpod_sqflite ^0.4.3`) so the engine resolves the same riverpod
core consuming apps do; generated code must be built against the core the app
compiles against, and riverpod 3.3.x changed `Notifier.runBuild`'s signature.

### Removed
- The Supabase stack in full: `supabase_flutter`, the vendored
`supabase/{migrations,functions,seed.sql,config.toml}`, the `sync_supabase`
CLI that copied it into consuming apps, and the `update-ratings` /
`refresh-fcm-token` edge functions. Ratings, notifications and every other
server-side concern now live in the engine.
- `google_fonts`, which fetched Inter at runtime, replaced by the bundled
package font above.

[Unreleased]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_flutter-v0.7.0...HEAD
[0.7.0]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_flutter-v0.6.0...eigen_flutter-v0.7.0
[0.6.0]: https://github.com/eigeninteractive/eigen-flutter/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/eigeninteractive/eigen-flutter/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/eigeninteractive/eigen-flutter/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/eigeninteractive/eigen-flutter/compare/v0.3.7...v0.4.0
[0.3.7]: https://github.com/eigeninteractive/eigen-flutter/compare/v0.3.6...v0.3.7
[0.3.6]: https://github.com/eigeninteractive/eigen-flutter/compare/v0.3.5...v0.3.6
[0.3.5]: https://github.com/eigeninteractive/eigen-flutter/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/eigeninteractive/eigen-flutter/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/eigeninteractive/eigen-flutter/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/eigeninteractive/eigen-flutter/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/eigeninteractive/eigen-flutter/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/eigeninteractive/eigen-flutter/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/eigeninteractive/eigen-flutter/compare/v0.1.0...v0.2.0
[0.1.0]: https://pub.dev/packages/eigen_flutter/versions/0.1.0
