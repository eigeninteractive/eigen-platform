---
sidebar_position: 2
title: Configuration
description: Both halves of a deployment's runtime config. The Worker's bindings and secrets, the app's AppConfig, and the Firebase project they share.
---

# Configuration

A deployment has two configuration surfaces and one thing they share. The Worker
reads bindings off its `Env`; the app injects an `AppConfig` at its composition
root. Game-owned bindings are handed over through typed accessors, while the
engine reserves a small set of environment names for cross-cutting credentials
such as Firebase Admin. The app remains explicit and injects every runtime
value, keeping the framework app-agnostic and the Worker free to name its D1,
Durable Object and R2 bindings.

The shared piece is the Firebase project: the app signs users in against it, and
the Worker verifies the resulting tokens against the same project id.

## The Worker

An implementor's entire runtime surface is one `createEngine` call plus a
`BaseGameDO` subclass; see [Deploy the Worker](./deploy-the-worker.md) for the
code. Optional blocks (`deepLink`, `avatars`, `site`, `lifecycle`) are simply
absent when a feature is not wanted; the corresponding routes are then not
mounted.

| Kind | Name | Required | What it enables |
|---|---|---|---|
| Durable Object | `GameDO` (SQLite storage, via the `exports` field) | **yes** | The per-game session + history |
| D1 database | any binding | **yes** | Identity, social, bots, ratings, summaries. `migrations_dir` points at `node_modules/@eigeninteractive/server/migrations` |
| Cron trigger | daily | **yes** in practice | The guest purge, abandoned-game reap, and read-model reconciliation. Without it those three backstops never run |
| Assets | `ASSETS` → `./public` | **yes for web** | Flutter bundle, served directly unless a path is in `run_worker_first` |
| R2 bucket | any binding | optional | Avatar uploads (`avatars` config block) |
| Var | `FIREBASE_PROJECT_ID` | **yes** | Token verification, and the only thing it needs. Written by scaffolding from the configured project; empty ⇒ every authed request 500s |
| Var | `WEB_APP_ORIGIN` | **yes for web** | Canonical Flutter origin used for absolute notification click links and automatically trusted for cross-origin browser REST and WebSocket requests |
| Secret | `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` | **yes** | Push (FCM) **and** the Identity-Toolkit admin delete used by account deletion |
| Secret | `SOCKET_TICKET_SECRET` | **yes** | Signs the 60-second game-scoped credentials used by WebSocket upgrades; at least 32 characters |
| Secret | `BOT_SIGNING_SECRET` | optional | External bots (the per-bot HMAC is derived from it) |
| Secret | `OPS_TOKEN` | optional | The operator surface (`/api/ops`). Unset ⇒ every route there answers 404 |

The entries under `wrangler.jsonc` → `vars` are Worker environment variables,
not TypeScript constants. They are used locally and uploaded with every
deployment, so keep `FIREBASE_PROJECT_ID` and `WEB_APP_ORIGIN` there as the
single source of truth. `.dev.vars` is only for the Firebase credentials and
other secrets that must not be committed.

Generate the socket-ticket secret independently with `openssl rand -base64 32`;
it is an engine signing key, not a Firebase value. The Firebase service account belongs to the same project the app already uses
for Auth; notifications do not introduce a second backend account. Production
authenticated requests reject missing Admin credentials instead of silently
running without push or leaving a Firebase identity behind during account
deletion. Optional feature blocks still stay off when absent; for example, no
`BOT_SIGNING_SECRET` means external bot webhooks are rejected, and no `OPS_TOKEN`
means the operator surface does not exist rather than being guarded.

The full type is in the
[`@eigeninteractive/server` reference](../reference/typescript/server.md).

:::warning[The app-custom-data rule]

If a game needs its own tables, they go in a **second D1 database** with its own
`migrations_dir`. Never add tables to the engine's database, since the engine owns
that schema, and its migrations will not know about them.

:::

## The app

One `AppConfig` passed to `runEngineApp`: `Branding` (name, theme seed) plus
`EngineConfig` (the injected runtime values). The app reads Dart compilation
environment declarations once at this composition root; the framework does not
read hidden process or file state.

```dart
const apiBaseUrl = String.fromEnvironment('API_BASE_URL');
const googleWebClientId = String.fromEnvironment('GOOGLE_WEB_CLIENT_ID');
const firebaseVapidKey = String.fromEnvironment('FIREBASE_VAPID_KEY');
const appHost = String.fromEnvironment('APP_HOST');
const authDomain = String.fromEnvironment('AUTH_DOMAIN');

await runEngineApp(
  module: const RpsModule(),
  config: AppConfig(
    branding: const Branding(appName: 'Rock Paper Scissors', seedColor: Colors.teal),
    engine: EngineConfig(
      apiBaseUrl: apiBaseUrl,
      googleWebClientId: googleWebClientId,
      firebaseVapidKey: firebaseVapidKey,
      appHost: appHost.isEmpty ? null : appHost,
      authDomain: authDomain.isEmpty ? null : authDomain,
    ),
  ),
  firebaseOptions: DefaultFirebaseOptions.currentPlatform,
  onBackgroundMessage: _onBackgroundMessage,
);
```

The scaffold stores these public values in `app/app-config.json`. Pass that
same file to every Flutter run or build; no generated environment class or
configuration code-generation step is needed:

```bash
flutter run --dart-define-from-file=app-config.json
flutter build appbundle --release \
  --dart-define-from-file=app-config.json
```

| Var | Required | Purpose |
|---|---|---|
| `API_BASE_URL` | **yes** | Origin of the Worker: scheme + host only, **no path, no trailing slash**. Routes carry their own `/api/engine` prefix; the socket is this origin with `ws`/`wss`. |
| `GOOGLE_WEB_CLIENT_ID` | yes | Google Sign-In. Both platforms use the *web* client, so an Android-only app still needs it. |
| `APP_HOST` | optional | This game's hostname, without scheme. In the default deployment it is the host part of `API_BASE_URL`; it enables invite/replay sharing and legal links. `/download` is the native install page. |
| `AUTH_DOMAIN` | optional | Firebase Auth's own domain, without scheme, overriding the project default. Cosmetic and web-only: it is the hostname Google's account chooser names during sign-in. **Not `APP_HOST`**; it must be a Firebase Hosting domain. See [Deploy the web app](./deploy-the-web-app.md#the-hostname-players-see-when-they-sign-in). |
| `FIREBASE_VAPID_KEY` | **yes for web** | Public FCM Web Push key from the same Firebase project. An empty key is a web startup configuration error. Android does not consume it. |

These values are embedded in the Android binary or downloaded web bundle and
must never be treated as secrets. `runEngineApp` validates all of them before
initializing Firebase and reports every missing or malformed value together.
Worker service-account keys, bot signing keys, and other real credentials stay
in Worker secrets.

### Where each value comes from

Scaffolding fills in what it can, so a fresh project does not start from four
empty strings. What it leaves is what no CLI can produce.

| Var | In a fresh scaffold | Where to get it |
|---|---|---|
| `API_BASE_URL` | `http://localhost:8787` | Already correct for local development. At deploy time it becomes the custom domain the Worker is attached to. |
| `GOOGLE_WEB_CLIENT_ID` | filled in after `firebase:configure`, when there is one to copy | Firebase Console → Authentication → Sign-in method → Google → **Web SDK configuration**. It is also the `"client_type": 3` entry of `app/android/app/google-services.json`. |
| `FIREBASE_VAPID_KEY` | empty | Firebase Console → Project settings → **Cloud Messaging** → Web configuration, **Generate key pair** if the list is empty. Web Push certificates are not served by the Firebase CLI, so this is always a manual copy. |
| `APP_HOST` | empty | Your hostname once you have one. Leave it empty locally; sharing links are simply off. |
| `AUTH_DOMAIN` | empty | Nothing to get, and most games never set it. Empty means sign-in uses the Firebase project's own domain, which works everywhere. |

An empty `GOOGLE_WEB_CLIENT_ID` after a successful `firebase:configure` means
one thing: **the Google sign-in provider was never enabled**. Firebase creates
that OAuth client when the provider is turned on, and turning it on is a console
action no CLI performs, so there was nothing to copy. Enable it, then take the
value from the same page.

On the Worker side, `FIREBASE_PROJECT_ID` in `wrangler.jsonc` is likewise
written from the project FlutterFire recorded in `app/firebase.json`.
`WEB_APP_ORIGIN` ships as `http://localhost:7357`, the port the Worker template
already trusts. Both need changing only at deploy.

All of that filling-in is `configure_firebase`'s, not the scaffolder's, so
**`firebase:configure` and a fresh scaffold leave a project in the same
state**. The Worker half is the `--worker` flag:

```bash
dart run eigen_flutter:configure_firebase --worker ../server
```

The generated `firebase:configure` script already passes it. An app-only
repository omits it and gets `app-config.json` alone, since there is no
`wrangler.jsonc` to write to.

The Worker edit rewrites that one assignment in place, so the comments in the
file survive. It requires the key to appear **exactly once**: a second
occurrence, including a commented-out one, means the file is not the one the
tool knows how to edit, so it writes nothing and says so rather than guessing
which you meant.

## Firebase, once per deployment

Firebase is mandatory on the client. A fresh scaffold contains a throwing
`firebase_options.dart` seam so analysis works before project setup, but the app
will not start until FlutterFire replaces it with real platform configuration.

1. **Create the project**, either at console.firebase.google.com or by letting
   step 2 do it: the first run offers to. The two differ in one respect. Only
   the console's create flow links a Google Analytics account, so a project
   created through the CLI reports *"Google Analytics not enabled for Project"*
   and the engine's automatic events have nowhere to land. Link one afterwards
   under Settings → Integrations → Google Analytics. Crashlytics reports either
   way.
2. Install and authenticate the official tooling:

   ```bash
   curl -sL https://firebase.tools | bash
   firebase login
   dart pub global activate flutterfire_cli
   ```

   That first line is Google's own installer;
   [the Firebase CLI reference](https://firebase.google.com/docs/cli) has the
   other ways, including Windows.

   Both are checked before anything is written, including the sign-in: the two
   CLIs share one set of stored Google credentials, and a missing one is named
   with the command that fixes it rather than surfacing several steps later.

   From a scaffolded repository root, run:

   ```bash
   pnpm firebase:configure
   # or: npm run firebase:configure
   ```

   Scaffolding runs this step already, so on a project created with the two
   CLIs installed and signed in this is the command for *changing* the
   configuration rather than establishing it. Only `create-eigen-game
   --no-firebase`, or answering yes when it asked whether to scaffold without
   the tooling, leaves it for here.

   It prompts for the Firebase project when none has been chosen, and creating
   one is an option there; pass `-- --project my-project-id` to answer up
   front. Later runs reuse the project recorded in `app/firebase.json`, so
   re-running to pick up a configuration change asks nothing.

   Each run ends by naming the project and the Android and Web app IDs it
   configured against. Read them when the project already had apps in it:
   FlutterFire matches an existing Android app on the `applicationId` and an
   existing Web app on its display name, and **adopts either without comment**,
   so those IDs are the only thing separating "reused what was there" from
   "registered something new". Adopting is usually what you want, since it is
   how re-pointing an app at its own project works, but it is also how two games
   that resolve to the same `applicationId` end up sharing one Firebase app,
   and with it their push, Analytics and Crashlytics.

   The engine executable runs FlutterFire for Android and Web, reads the Web
   app ID FlutterFire records in `app/firebase.json`, asks the Firebase CLI for
   that app's SDK configuration, and writes
   `app/web/firebase-config.js`. This keeps
   `app/lib/firebase_options.dart` and the messaging worker on the same
   Firebase Web app without copying identifiers. In a standalone app
   repository, run `dart run eigen_flutter:configure_firebase` from the Flutter
   root.

   **Commit what it writes.** `app/firebase.json`,
   `app/android/app/google-services.json`, `app/lib/firebase_options.dart`,
   `app/web/firebase-config.js` and FlutterFire's two Android Gradle edits are
   all public app identifiers, none of them are git-ignored, and Android and
   web builds fail without them. The Firebase secrets are the Worker's
   service-account email and private key, which never appear in `app/`.
3. **Add SHA fingerprints** to the Android app. `flutterfire` does *not* do this,
   and Google Sign-In validates the calling app's certificate at runtime:
   - **Now:** the debug key, so Sign-In works in dev builds.

     ```bash
     keytool -list -v -keystore ~/.android/debug.keystore \
       -alias androiddebugkey -storepass android -keypass android
     ```

   - **After the first Play upload:** the **Play App Signing** certificate
     (Play Console → Release → Setup → App signing). Play re-signs your bundle
     with *their* key, so the app on users' devices is not signed with yours.
     **omitting this is why Sign-In "works in dev and fails in production."**
4. Enable **Crashlytics** for Android and verify **Cloud Messaging** is on.
   Crashlytics has no Flutter web implementation; use your hosting/browser
   observability for uncaught web failures.
5. **Android FID registration:** `eigen_flutter` is an Android Flutter plugin.
   Its library manifest enables
   `firebase_messaging_installation_id_enabled`, and its exported Firebase BoM
   constraint selects a native Messaging SDK with FID registration. This works
   for scaffolded and hand-created apps that depend on `eigen_flutter`; do not
   edit the generated application manifest or `gradle.properties`. The engine's
   explicit BoM constraint can be removed once FlutterFire selects Messaging
   25.1.0 or newer itself. See Firebase's
   [Android release notes](https://firebase.google.com/support/release-notes/android#messaging_v25-1-0).
6. **Android desugaring:** foreground notifications use
   `flutter_local_notifications`, which requires core-library desugaring in the
   application module. The scaffold adds the required compiler setting and
   `desugar_jdk_libs` dependency. Hand-created apps should copy the Gradle block
   from [Manual setup](../getting-started/manual-setup.md#create-the-flutter-app).
7. **Web Push key:** Project Settings → Cloud Messaging → Web configuration →
   generate a Web Push certificate. Pass its public VAPID key as
   `FIREBASE_VAPID_KEY`.
8. **Server-side Firebase credentials:** Project Settings → Service Accounts →
   Generate new private key. The Worker needs only `client_email` and
   `private_key` from that JSON. Set them as Worker secrets and **delete the
   downloaded file**; it grants full Firebase Admin access.

FCM is a no-cost Firebase product on both Spark and Blaze plans. Requiring it
adds configuration to the Firebase project already needed by Auth, not another
account or payment method.

These are instance-specific Firebase configuration files. They contain public
app identifiers, not service-account secrets; either commit the correct
environment's files or reconstruct them in CI:

| File | Platform |
|---|---|
| `lib/firebase_options.dart` | Dart, all platforms |
| `android/app/google-services.json` | Android native |
| `web/firebase-config.js` | Generated public Web config for the messaging worker |
| `firebase.json` | FlutterFire CLI metadata and selected Firebase app IDs |

Web Push also requires the app-owned
`web/firebase-messaging-sw.js`. A service worker runs outside Dart and cannot
import `firebase_options.dart`, so it imports the generated
`firebase-config.js` instead. The VAPID public key remains in `app-config.json`:
Firebase's app SDK configuration does not include the Web Push certificate.
See [Deploy the web app](./deploy-the-web-app.md).

## Avatars (optional)

Avatars are opt-in R2, and uploads go **through the Worker** because R2 has no
per-user access control: a raw-binary `PUT /api/engine/me/avatar`
(type- and size-validated) stores the image under key = uid, and a public
`GET /avatars/:uid` serves it with a long immutable cache. The stored
`avatar_url` carries a `?v=<ts>` cache-buster, since the key is overwritten on
re-upload, which is also what makes the client's cached images refresh with no
manual invalidation.

An optional `avatars.publicBaseUrl` points the URL straight at a bucket custom
domain, bypassing the Worker for reads. The whole "serve from the bucket" flip is
a config value, not a code change. The default worker-served path is the only one
that works on a zoneless `workers.dev` deploy.

On the client, every avatar routes through `PlayerAvatar`, which resolves a
relative URL against the API origin, so both setups work with no app change.
`cached_network_image` has no package-managed disk cache in a browser; the
browser's HTTP cache honors the Worker's immutable response, and the versioned
URL makes an upload a new cache entry.

## Generated artifacts

Two, both engine-owned. You consume them; you never author them:

- **D1 migrations** ship inside `@eigeninteractive/server` and are applied with
  `wrangler d1 migrations apply`, **never at runtime**. The **Durable Object
  SQLite schema self-applies** on activation (`blockConcurrencyWhile`), which is
  what lets a finished game woken years later migrate itself before serving
  anything.
- **`openapi.json`** is emitted from the engine's route definitions. The typed
  Dart client is generated from it, committed, and published to pub.dev as
  `eigen_api` at the engine's version, so an app consumes it as an ordinary
  dependency rather than regenerating it from a copied spec.

The wire loop is a **standing rule, not a suggestion**: a shape the generated
client consumes badly gets fixed in the server's schemas and regenerated, never
patched around in Dart. Re-emit `openapi.json` and rerun the client generator
**in the same change**, because the two repos have no other coupling that would
catch the drift.

:::note[Unknown engine enum values]

Generated Dart transport enums decode a new wire member as
`unknownDefaultOpenApi`, allowing the app to show its update-required state
instead of crashing during response decoding. The fallback is read-only; never
send it back to a route.

:::

## The operator surface (optional)

Set `OPS_TOKEN` with `wrangler secret put OPS_TOKEN` to enable `/api/ops`. It
authenticates with that secret alone — an operator is not a player and holds no
account — and every route answers `404` while the secret is unset, so a deployment
that never sets one has nothing to probe.

Two routes, both about one game:

```bash
# What the Durable Object holds, and what D1 believes, side by side.
curl -H "Authorization: Bearer $OPS_TOKEN" \
  https://your-worker/api/ops/games/<gameId>

# Rewrite D1's copy from the object, and retry a finish whose apply never landed.
curl -X POST -H "Authorization: Bearer $OPS_TOKEN" \
  https://your-worker/api/ops/games/<gameId>/reconcile
```

`reconcile` is idempotent and safe on a healthy game, which matters because the
reason to run it is usually a suspicion rather than a diagnosis. It reports what it
found: `finishRepoked` means a finished game's rating deltas had never been written
and now are; `alarmRearmed` means the armed deadline disagreed with committed state.
`initialized: false` means the object holds no committed state, so D1's row is the
only truth there is and there was nothing to reconcile against.

You should rarely need it. The daily cron already sweeps for the same divergence —
active games long past their deadline, and non-terminal games D1 has not heard from
in a week — and repairs them the same way. This is the entry point for a specific
game you are looking at now.

`inspect` deliberately returns the **unseated** view of the game, exactly what a
spectator sees. It carries no observation data, so it cannot become a cheating
channel for a live game no matter who holds the secret.

These routes are not in the OpenAPI document and not in the generated clients. A
player's app has no business knowing they exist.

## Registering bots

There is no provisioning route. A bot is a row an operator inserts into D1, one
time, by hand:

```sql
-- an engine bot: the brain ships in the game module as
-- GameRules.botActions['easy_ai']; no webhook, no key material.
INSERT INTO bots (id, username, display_name, type, schema_version, rated_eligible, config)
VALUES (lower(hex(randomblob(16))), 'easy_ai', 'Easy AI', 'engine', 1, 0, '{}');

-- an external bot: hosted elsewhere, woken over HTTPS.
INSERT INTO bots (id, username, display_name, type, schema_version, webhook_url, rated_eligible, config)
VALUES (lower(hex(randomblob(16))), 'hard_ai', 'Hard AI', 'external', 1,
        'https://my-bot.example/wake', 1, '{}');
```

`type` is CHECK-enforced against the transport it implies: an `external` bot
must carry a `webhook_url`, an `engine` bot must not. `schema_version` is the
highest game schema the bot supports; seating refuses a bot below the game's
version, mirroring the human join gate. `rated_eligible` is required for a rated
game. `config` is **public read-only reference data** consumed by the
`botSeatable` hook and the client's pickers, so never put a secret in it.

Then hand the bot's owner **one derived key**,
`await deriveBotKey(BOT_SIGNING_SECRET, botId)` from `@eigeninteractive/server`, or the
[`openssl` one-liner](../how-it-works/bots.md#external-bot-hmac), and never the
master secret. Adding a bot therefore needs no new secret and no redeploy.
