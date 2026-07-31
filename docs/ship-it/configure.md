---
sidebar_position: 2
title: Configuration
description: Both halves of a deployment's runtime config — the Worker's bindings and secrets, the app's AppConfig, and the Firebase project they share.
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
`BaseGameDO` subclass — see [Deploy the Worker](./deploy-the-worker.md) for the
code. Optional blocks (`deepLink`, `avatars`, `site`, `lifecycle`) are simply
absent when a feature is not wanted; the corresponding routes are then not
mounted.

| Kind | Name | Required | What it enables |
|---|---|---|---|
| Durable Object | `GameDO` (SQLite storage, via the `exports` field) | **yes** | The per-game session + history |
| D1 database | any binding | **yes** | Identity, social, bots, ratings, summaries. `migrations_dir` points at `node_modules/@eigeninteractive/server/migrations` |
| Cron trigger | daily | **yes** in practice | The guest purge + abandoned-game reap. Without it those two backstops never run |
| Assets | `ASSETS` → `./public` | **yes for web** | Flutter bundle, served directly unless a path is in `run_worker_first` |
| R2 bucket | any binding | optional | Avatar uploads (`avatars` config block) |
| Var | `FIREBASE_PROJECT_ID` | **yes** | Token verification. Empty ⇒ every authed request 500s |
| Var | `WEB_APP_ORIGIN` | **yes for web** | Canonical Flutter origin used for absolute notification click links and automatically trusted for cross-origin browser REST and WebSocket requests |
| Secret | `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` | **yes** | Push (FCM) **and** the Identity-Toolkit admin delete used by account deletion |
| Secret | `BOT_SIGNING_SECRET` | optional | External bots (the per-bot HMAC is derived from it) |

The entries under `wrangler.jsonc` → `vars` are Worker environment variables,
not TypeScript constants. They are used locally and uploaded with every
deployment, so keep `FIREBASE_PROJECT_ID` and `WEB_APP_ORIGIN` there as the
single source of truth. `.dev.vars` is only for the Firebase credentials and
other secrets that must not be committed.

The Firebase service account belongs to the same project the app already uses
for Auth; notifications do not introduce a second backend account. Production
authenticated requests reject missing Admin credentials instead of silently
running without push or leaving a Firebase identity behind during account
deletion. Optional feature blocks still stay off when absent; for example, no
`BOT_SIGNING_SECRET` means external bot webhooks are rejected.

The full type is in the
[`@eigeninteractive/server` reference](../reference/typescript/server.md).

:::warning The app-custom-data rule

If a game needs its own tables, they go in a **second D1 database** with its own
`migrations_dir`. Never add tables to the engine's database — the engine owns
that schema, and its migrations will not know about them.

:::

## The app

One `AppConfig` passed to `runEngineApp`: `Branding` (name, theme seed) plus
`EngineConfig` (the injected runtime values). **Nothing is read from `Env` inside
the framework** — the app owns its env plumbing and hands values in.

```dart
await runEngineApp(
  module: const RpsModule(),
  config: AppConfig(
    branding: const Branding(appName: 'Rock Paper Scissors', seedColor: Colors.teal),
    engine: EngineConfig(
      apiBaseUrl: Env.apiBaseUrl,
      googleWebClientId: Env.googleWebClientId,
      firebaseVapidKey: Env.firebaseVapidKey,
      appHost: Env.appHost,
    ),
  ),
  firebaseOptions: DefaultFirebaseOptions.currentPlatform,
  onBackgroundMessage: _onBackgroundMessage,
);
```

The values come from `.env` (git-ignored, read by `envied`; regenerate with
`dart run build_runner build` after any change):

| Var | Required | Purpose |
|---|---|---|
| `API_BASE_URL` | **yes** | Origin of the Worker — scheme + host only, **no path, no trailing slash**. Routes carry their own `/api/engine` prefix; the socket is this origin with `ws`/`wss`. |
| `GOOGLE_WEB_CLIENT_ID` | yes | Google Sign-In. |
| `APP_HOST` | optional | This game's hostname, without scheme. In the default deployment it is the host part of `API_BASE_URL`; it enables invite/replay sharing and legal links. `/download` is the native install page. |
| `FIREBASE_VAPID_KEY` | **yes for web** | Public FCM Web Push key from the same Firebase project. An empty key is a web startup configuration error. Android does not consume it. |

## Firebase — once per deployment

Firebase is mandatory on the client: the app will not compile without
`firebase_options.dart`, even for local development.

1. **Create the project** at console.firebase.google.com with Analytics enabled.
2. `npm i -g firebase-tools && firebase login`, then
   `dart pub global activate flutterfire_cli`, then **`flutterfire configure`** —
   select Android and Web. It registers both apps and writes
   `firebase_options.dart`.
3. **Add SHA fingerprints** to the Android app. `flutterfire` does *not* do this,
   and Google Sign-In validates the calling app's certificate at runtime:
   - **Now:** the debug key, so Sign-In works in dev builds.

     ```bash
     keytool -list -v -keystore ~/.android/debug.keystore \
       -alias androiddebugkey -storepass android -keypass android
     ```

   - **After the first Play upload:** the **Play App Signing** certificate
     (Play Console → Release → Setup → App signing). Play re-signs your bundle
     with *their* key, so the app on users' devices is not signed with yours —
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
   `private_key` from that JSON — set them as Worker secrets and **delete the
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
| `firebase.json` | FlutterFire CLI metadata — **not** needed in CI |

Web Push also requires the app-owned
`web/firebase-messaging-sw.js`. Its Firebase config repeats the public Web
values because a service worker runs outside Dart and cannot import
`firebase_options.dart`. See [Deploy the web app](./deploy-the-web-app.md).

## Avatars (optional)

Avatars are opt-in R2, and uploads go **through the Worker** because R2 has no
per-user access control: a raw-binary `PUT /api/engine/me/avatar`
(type- and size-validated) stores the image under key = uid, and a public
`GET /avatars/:uid` serves it with a long immutable cache. The stored
`avatar_url` carries a `?v=<ts>` cache-buster, since the key is overwritten on
re-upload — which is also what makes the client's cached images refresh with no
manual invalidation.

An optional `avatars.publicBaseUrl` points the URL straight at a bucket custom
domain, bypassing the Worker for reads. The whole "serve from the bucket" flip is
a config value, not a code change. The default worker-served path is the only one
that works on a zoneless `workers.dev` deploy.

On the client, every avatar routes through `PlayerAvatar`, which resolves a
relative URL against the API origin — so both setups work with no app change.
`cached_network_image` has no package-managed disk cache in a browser; the
browser's HTTP cache honors the Worker's immutable response, and the versioned
URL makes an upload a new cache entry.

## Generated artifacts

Two, both engine-owned, both regenerated by a command rather than hand-edited:

- **D1 migrations** are generated with drizzle-kit (`pnpm db:generate:d1`) and
  applied with `wrangler d1 migrations apply` — **never at runtime**. They ship
  inside `@eigeninteractive/server`, so you apply them but never author them. The **Durable
  Object SQLite schema self-applies** on activation (`blockConcurrencyWhile`),
  which is what lets a finished game woken years later migrate itself before
  serving anything.
- **`openapi.json`** is emitted from the route definitions (`pnpm openapi`).
  The typed Dart client is generated from it in the same repository
  (`pnpm dart-client`), committed, and published to pub.dev as `eigen_api` at
  the engine's version — so an app consumes it as an ordinary dependency rather
  than regenerating it from a copied spec.

The wire loop is a **standing rule, not a suggestion**: a shape the generated
client consumes badly gets fixed in the server's schemas and regenerated — never
patched around in Dart. Re-emit `openapi.json` and rerun the client generator
**in the same change**, because the two repos have no other coupling that would
catch the drift.

:::note Unknown engine enum values

Generated Dart transport enums decode a new wire member as
`unknownDefaultOpenApi`, allowing the app to show its update-required state
instead of crashing during response decoding. The fallback is read-only; never
send it back to a route.

:::

## Registering bots

There is no provisioning route — a bot is a row an operator inserts into D1, one
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

`type` is CHECK-enforced against the transport it implies — an `external` bot
must carry a `webhook_url`, an `engine` bot must not. `schema_version` is the
highest game schema the bot supports; seating refuses a bot below the game's
version, mirroring the human join gate. `rated_eligible` is required for a rated
game. `config` is **public read-only reference data** consumed by the
`botSeatable` hook and the client's pickers — never put a secret in it.

Then hand the bot's owner **one derived key** —
`await deriveBotKey(BOT_SIGNING_SECRET, botId)` from `@eigeninteractive/server`, or the
[`openssl` one-liner](../how-it-works/bots.md#external-bot-hmac) — and never the
master secret. Adding a bot therefore needs no new secret and no redeploy.
