---
sidebar_position: 2
title: Deploy the web app
description: Build Flutter into the game Worker so the SPA, API, app links, legal pages, and native download page share one canonical origin.
---

# Deploy the web app

The scaffolded Flutter app is an Android **and web** app. The default production
deployment uses **one canonical origin** such as `https://rps.example.com`:

| Path | Served by |
|---|---|
| `/`, `/home`, and other app routes | Flutter web through Workers Static Assets |
| `/join/:code`, `/game/:id` | Worker-enriched Flutter shell with dynamic share metadata |
| `/api/*`, `/health`, `/avatars/*` | Worker |
| `/.well-known/*` | Worker-generated native app-link verification |
| `/terms`, `/privacy`, `/delete-account` | Worker-generated legal pages |
| `/download` | Server-rendered native app download page |

`eigeninteractive.com` remains the engine documentation/company site; it does
not host an implementor's game. A custom game may use any domain.

Web uses the same
widgets, Riverpod state, generated API client and game module as Android; only
the browser integration points differ:

- Firebase Auth opens Google's Firebase-managed popup;
- REST, avatars, and sockets are same-origin in production;
- the game feed uses `wss://…?token=…`, because browser WebSocket upgrades
  cannot set an `Authorization` header;
- Firebase Messaging runs background delivery in a service worker;
- server responses stay in Riverpod memory for the browser session and are
  fetched again after a reload. Firebase Auth and small user preferences retain
  their own browser persistence.

## 1. Use a stable local origin

OAuth and Worker origin policy both match origins, not arbitrary development
ports. Run Flutter on the scaffold's fixed port:

```bash
cd app
flutter run -d chrome --web-hostname localhost --web-port 7357 \
  --dart-define-from-file=app-config.json
```

Local development deliberately uses two origins, so Flutter can hot reload
independently of Wrangler. The Worker template starts with:

```jsonc
"vars": {
  "WEB_APP_ORIGIN": "http://localhost:7357"
}
```

The engine automatically trusts that exact origin for browser REST and
WebSocket requests. Set it to the game's canonical origin in production; it
also supplies the absolute HTTPS target for background notification clicks.
Same-origin browser requests are accepted automatically. Configure
`clientOrigins` in `createEngine` only to replace this convention with multiple
or otherwise non-standard origins.

## 2. Configure Firebase for web

From the generated repository root, configure Android, Flutter Web, and the
messaging worker together:

```bash
pnpm firebase:configure
# or: npm run firebase:configure
```

For an app maintained in its own repository, run
`dart run eigen_flutter:configure_firebase` from the Flutter root. Both forms
run FlutterFire for Android and Web, then derive the service worker
configuration from the Web app FlutterFire selected.

The first run prompts you to pick a Firebase project — or create one — since
there is nothing yet to tell it which. Name the project instead to skip the
prompts, which is also how you drive this from CI:

```bash
pnpm firebase:configure -- --project my-project-id
# or: npm run firebase:configure -- --project my-project-id
```

After that first run there is nothing to pass: the project is recorded in
`app/firebase.json` and reused, so re-running to pick up a new configuration is
non-interactive. `--account <email>` picks the Google account on a machine
signed in to several, and `--help` lists the lot. `create-eigen-game
--firebase` runs the same step during scaffolding, so what it generates is part
of the scaffold commit rather than the project's first diff.

Platforms are not configurable here — the app is Android and Web, and the
service worker configuration is derived from the Web app. For anything outside
that, run `flutterfire configure` yourself. Use the generated options in
`runEngineApp`:

```dart
firebaseOptions: DefaultFirebaseOptions.currentPlatform,
```

Enable Google in Firebase Authentication, then add both
`localhost` and the production app domain under Authentication → Settings →
Authorized domains. The Google OAuth web client must list the same values as
authorized JavaScript origins.

`firebase_options.dart` contains public app identifiers, not a service-account
secret. It may be committed, or generated per environment in CI. The Worker
service-account private key remains a secret.

## 3. Finish Web Push

The scaffold contains:

- `web/firebase-messaging-sw.js`, which receives background messages;
- `web/firebase-config.js`, generated from FlutterFire's selected Web app;
- `web/flutter_bootstrap.js`, which registers that worker before Flutter starts;
- an `app-config.json` containing the public `FIREBASE_VAPID_KEY` consumed by
  `EngineConfig`.

Do not copy Firebase identifiers into the service worker. It imports the
generated `firebase-config.js`; rerunning `firebase:configure` updates both it
and `firebase_options.dart` from the same selected Firebase app. Both generated
files contain public application identifiers, not Firebase Admin credentials.

Generate or copy the public Web Push certificate key from Firebase Console →
Project Settings → Cloud Messaging → Web configuration, then put it in
`app-config.json` before running the command from step 1.

The VAPID key is public but required for the engine's web target. An empty key
stops web startup with an actionable configuration error; it is not treated as a
player-facing “notifications unavailable” state. A browser that does not
support Web Push still degrades gracefully. On a supported browser, the app
requests permission only after the player taps **Enable notifications** in the
contextual multiplayer waiting-room explanation (or the secondary action in
Settings); initialization never opens the browser prompt.

After a grant, the app creates the FCM subscription and registers its Firebase
Installation ID with the Worker. Installation rotation, sign-in and tab resume
all retry that reconciliation. If permission is later revoked, the stale Worker
registration is removed on resume. The app uses Firebase's `register` API and
never requests or stores the deprecated registration token.

Background notifications display through Firebase's service worker integration.
For web installations the Worker resolves the relative `deepLink` against its
HTTPS `WEB_APP_ORIGIN` and sends the result as
`webpush.fcm_options.link`. A `/game/:id` notification therefore opens that
absolute app URL; the SPA fallback then serves Flutter and the router restores
the route. Local HTTP development intentionally omits the click action because
FCM requires a secure URL.

`eigen_flutter` bundles the pinned Cropper.js JavaScript, stylesheet, and MIT
license required by `image_cropper`, and loads the browser assets only when
avatar editing starts. The app needs no Cropper.js files or `web/index.html`
tags, has no runtime CDN dependency, and keeps `flutter_bootstrap.js` concerned
only with registering FCM before Flutter starts.

## 4. Build and deploy one artifact

Edit the scaffolded `app/app-config.json`. These are public build-time values
shared by Android and web:

```json
{
  "API_BASE_URL": "https://rps.example.com",
  "APP_HOST": "rps.example.com",
  "GOOGLE_WEB_CLIENT_ID": "…apps.googleusercontent.com",
  "FIREBASE_VAPID_KEY": "…"
}
```

Attach the Worker itself to that hostname in `server/wrangler.jsonc`:

```jsonc
"workers_dev": false,
"preview_urls": false,
"routes": [
  { "pattern": "rps.example.com", "custom_domain": true }
]
```

A Custom Domain is the right Cloudflare routing mode here because the Worker is
the origin for the whole hostname; Cloudflare creates the DNS record and
certificate. Keep `workers.dev` during initial development if useful, then turn
it off in committed production config so a later Wrangler deploy cannot
silently re-enable a second public origin.

```bash
pnpm run deploy
```

The root script runs `flutter build web --release` directly into
`server/public/` with
`--dart-define-from-file=app-config.json`, applies D1 migrations, then deploys
the Worker and assets together. Wrangler's `single-page-application` fallback
handles clean Flutter paths. Its selective `run_worker_first` list keeps exact
static files on Cloudflare's asset path while reserving dynamic engine routes
for Worker code. There is no second hosting product or second deployment URL
to coordinate.

For the simple reload update model:

- serve `index.html`, `flutter_bootstrap.js`, `main.dart.js`, and
  `firebase-messaging-sw.js` plus `firebase-config.js` with revalidation or a
  short cache;
- immutable-hash assets may use a long cache;
- deploy the complete Worker + asset version atomically.

That makes the engine's update-required button reload into the current bundle.
The combined deploy removes the usual ordering race for web. Android still
needs version ordering: publish a compatible Play build before server behavior
that requires it.

### Deliberately splitting the origins

A separate static host remains supported. Point `API_BASE_URL` at the Worker,
set `APP_HOST` and `WEB_APP_ORIGIN` to the public web host, and configure that
host's SPA fallback yourself. Use `clientOrigins` only if more browser origins
must be trusted. You then own CORS, two deployments, cache policy, and ensuring
notification links land on the web app. This is an advanced topology, not the
scaffold default.

## 5. Verify the browser, not only the compiler

Before release, test at the production origin:

1. Google sign-in and guest upgrade;
2. an authenticated REST request and avatar upload;
3. a live game through `wss`;
4. a worker-served relative avatar URL;
5. notification opt-in plus background receipt and display;
6. a background notification click opens the exact absolute `/game/:id` URL,
   including when no app tab is already open;
7. direct navigation and refresh at `/game/:id` or `/join/:code`;
8. the update-required reload after replacing the deployed bundle.

The engine CI runs its browser socket and integration tests, then compiles the
RPS reference entrypoint with `flutter build web --release`. Your app CI should
do the same with `app-config.json`, `firebase_options.dart`, and the generated
`firebase-config.js`, then add credentialed browser integration tests for the
flows above.
