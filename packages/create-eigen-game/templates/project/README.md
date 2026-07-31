# Example Game

This repository contains the two application-owned halves of an Eigen game.
The engine itself is consumed from npm and pub.dev; its repositories are not
part of this project.

## Worker

```sh
cd server
{{PACKAGE_MANAGER}} install
{{PACKAGE_MANAGER}} run dev
```

The game module is the default export of `server/src/module/index.ts`. Whenever
a payload schema or shared fixture changes, regenerate the contract and Dart
payloads together from the repository root:

```sh
{{PACKAGE_MANAGER}} run contract
```

The scaffold includes a starter fixture and both language runners. Keep the
Worker tests watching while editing rules:

```sh
cd server
{{PACKAGE_MANAGER}} run test:watch
```

After changing a schema or fixture, run `{{PACKAGE_MANAGER}} run contract` from
the repository root, then `flutter test` from `app/`. Use
`{{PACKAGE_MANAGER}} run contract:check` from the root in CI. The server and
app commands remain independently usable if the two halves later move to
separate repositories.

## Flutter app

The initial scaffold already generates Dart payloads from the Worker contract.
Implement the client-side legality, preview and presentation rules under
`app/lib/game/`, then configure Firebase and the Worker origin in
`app/lib/main.dart`.

See `app/lib/game/README.md` for the regeneration command.

The app targets Android and web. Run the browser on the origin already allowed
by the Worker template:

```sh
cd app
flutter run -d chrome --web-hostname localhost --web-port 7357
```

For production, give the game one canonical custom domain, edit the public
values in `app/web-config.json`, then deploy both halves together:

```sh
{{PACKAGE_MANAGER}} run deploy
```

That builds Flutter into `server/public/` and deploys one Worker containing the
SPA and API. The app is `/`; invite and game URLs open the installed native app
or the browser SPA; the native install landing page is `/download`.

Select Android and Web in `flutterfire configure`, replace the public Firebase
placeholders in `web/firebase-messaging-sw.js`, and pass the public VAPID key as
`--dart-define=FIREBASE_VAPID_KEY=…`. `eigen_flutter` bundles the pinned
Cropper.js assets and loads them only when avatar editing starts, so the app
needs no Cropper.js setup or runtime CDN. The complete production checklist is at
https://eigeninteractive.com/docs/ship-it/deploy-the-web-app.

The `eigen_flutter` Android plugin enables Firebase's current FID-based
messaging mode and supplies a Firebase SDK new enough to support it. The
scaffolder leaves Flutter's generated manifest and `gradle.properties`
untouched; it adds only the application-level core-library desugaring block
required by `flutter_local_notifications`. Push registration is engine-owned;
game code does not request or store an FCM registration token.

The Worker uses that same Firebase project for push and complete account
deletion. Copy `server/.dev.vars.example` to `server/.dev.vars`, then fill its
service-account email and private key. The Firebase project ID and web origin
remain in `server/wrangler.jsonc`. For deployment, store the two credentials
with `wrangler secret put`; never commit the downloaded JSON or `.dev.vars`.
