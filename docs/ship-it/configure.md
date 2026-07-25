---
sidebar_position: 2
title: Configuration
description: Both halves of a deployment's runtime config — the Worker's bindings and secrets, the app's AppConfig, and the Firebase project they share.
---

# Configuration

A deployment has two configuration surfaces and one thing they share. The Worker
reads bindings off its `Env`; the app injects an `AppConfig` at its composition
root. **Neither discovers anything by convention** — every value is handed over
explicitly, which is what lets the framework stay app-agnostic and the engine
stay binding-name-agnostic.

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
| D1 database | any binding | **yes** | Identity, social, bots, ratings, summaries. `migrations_dir` points at `node_modules/@eigen/server/migrations` |
| Cron trigger | daily | **yes** in practice | The guest purge + abandoned-game reap. Without it those two backstops never run |
| Assets | `./public` directory | optional | Static files, served unmetered |
| R2 bucket | any binding | optional | Avatar uploads (`avatars` config block) |
| Var | `FIREBASE_PROJECT_ID` | **yes** | Token verification. Empty ⇒ every authed request 500s |
| Secret | `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` | optional | Push (FCM) **and** the Identity-Toolkit admin delete used by account deletion |
| Secret | `BOT_SIGNING_SECRET` | optional | External bots (the per-bot HMAC is derived from it) |

Each optional feature is **off** when unconfigured — no placeholder values, no
dummy credentials. A deploy with no service account sends no pushes and returns a
clean failure from `DELETE /me`; a deploy with no `BOT_SIGNING_SECRET` rejects
every bot webhook. That is why local development needs no real credentials.

The full type is in the
[`@eigen/server` reference](../reference/typescript/server.md).

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
| `APP_HOST` | optional | This game's public host. One host for everything: invite and replay deep links, the waiting-room QR code, and — when the Worker has `site` configured — the legal pages and landing page. All of them are hidden when unset. |
| `FIREBASE_VAPID_KEY` | optional | FCM Web Push (web only). |

## Firebase — once per deployment

Firebase is mandatory on the client: the app will not compile without
`firebase_options.dart`, even for local development.

1. **Create the project** at console.firebase.google.com with Analytics enabled.
2. `npm i -g firebase-tools && firebase login`, then
   `dart pub global activate flutterfire_cli`, then **`flutterfire configure`** —
   it registers the Android and iOS apps for you.
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
4. Enable **Crashlytics** and verify **Cloud Messaging** is on.
5. **iOS push:** create an APNs `.p8` key at developer.apple.com (Keys → Apple
   Push Notifications service), note the Key ID and Team ID, and upload it under
   Project Settings → Cloud Messaging. In Xcode, add the **Push Notifications**
   and **Background Modes → Remote notifications** capabilities to the Runner
   target.
6. **Server-side push credentials:** Project Settings → Service Accounts →
   Generate new private key. The Worker needs only `client_email` and
   `private_key` from that JSON — set them as Worker secrets and **delete the
   downloaded file**; it grants full Firebase Admin access.

These four generated files are **gitignored and must never be committed** — they
are instance-specific, and CI reconstructs them from secrets:

| File | Platform |
|---|---|
| `lib/firebase_options.dart` | Dart, all platforms |
| `android/app/google-services.json` | Android native |
| `ios/Runner/GoogleService-Info.plist` | iOS native |
| `firebase.json` | FlutterFire CLI metadata — **not** needed in CI |

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

## Generated artifacts

Two, both engine-owned, both regenerated by a command rather than hand-edited:

- **D1 migrations** are generated with drizzle-kit (`pnpm db:generate:d1`) and
  applied with `wrangler d1 migrations apply` — **never at runtime**. They ship
  inside `@eigen/server`, so you apply them but never author them. The **Durable
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

:::danger Wire enums are closed sets

Generated Dart enums carry no `unknown` sentinel and parse strictly, so adding a
member to any enum on the wire — `GameStatus`, `ErrorCode`, `GameAccess`, seat
type — is a **breaking change** needing a schema-version bump and a coordinated
client release. See [Changing a shipped game](../build-a-game/versions.md).

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
`await deriveBotKey(BOT_SIGNING_SECRET, botId)` from `@eigen/server`, or the
[`openssl` one-liner](../how-it-works/bots.md#external-bot-hmac) — and never the
master secret. Adding a bot therefore needs no new secret and no redeploy.
