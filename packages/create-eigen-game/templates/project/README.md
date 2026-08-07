# Example Game

This repository contains the two application-owned halves of an
EigenInteractive game. The engine itself is consumed from npm and pub.dev; its
repositories are not part of this project.

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

Biome lints and formats the Worker and this repository's JSON, with the rules
in `biome.json`:

```sh
{{PACKAGE_MANAGER}} run lint      # from the repository root
{{PACKAGE_MANAGER}} run format    # writes the fixes
```

The Flutter half is `dart format`'s and is excluded. `.editorconfig` covers
whitespace everywhere, including the YAML that Biome does not format, and
`.vscode/` recommends the Biome extension and turns formatting on save on for
the languages it owns. Change any of it — it is your repository — but the
generated files are written to satisfy it as shipped.

## Flutter app

The initial scaffold already generates Dart payloads from the Worker contract.
Implement the client-side legality, preview and presentation rules under
`app/lib/game/`, then configure Firebase and fill the public build-time values
in `app/app-config.json`. They are Dart compilation environment declarations,
not secrets; private credentials belong only in the Worker.

See `app/lib/game/README.md` for the regeneration command.

The app targets Android and web. Run the browser on the origin already allowed
by the Worker template:

```sh
cd app
flutter run -d chrome --web-hostname localhost --web-port 7357 \
  --dart-define-from-file=app-config.json
```

For production, give the game one canonical custom domain, edit the public
values in `app/app-config.json`, then deploy both halves together:

```sh
{{PACKAGE_MANAGER}} run deploy
```

That builds Flutter into `server/public/` and deploys one Worker containing the
SPA and API. The app is `/`; invite and game URLs open the installed native app
or the browser SPA; the native install landing page is `/download`.

Configure Android, Flutter Web, and the messaging service worker together:

```sh
{{PACKAGE_MANAGER}} run firebase:configure
```

That drives two CLIs, which are separate global installs and neither of which
comes with Flutter or Node:

```sh
npm install -g firebase-tools                # the `firebase` CLI
dart pub global activate flutterfire_cli     # the `flutterfire` CLI
export PATH="$PATH":"$HOME/.pub-cache/bin"   # `activate` does not do this
```

Then `firebase login`. Nothing before this point needs either tool — rules,
fixtures and `wrangler dev` all run without them — but the app itself throws
`Firebase is not configured` on launch until this has run once.

The command uses FlutterFire's selected Web app to generate both
`lib/firebase_options.dart` and `web/firebase-config.js`; do not copy Firebase
identifiers by hand. Put the public VAPID key in `app-config.json` separately —
Firebase's app SDK configuration does not include that Web Push certificate.
`eigen_flutter` bundles the pinned Cropper.js assets and loads them only when
avatar editing starts, so the app needs no Cropper.js setup or runtime CDN. The
complete production checklist is at
https://eigeninteractive.com/docs/ship-it/deploy-the-web-app.

Android releases use the same configuration file:

```sh
{{PACKAGE_MANAGER}} run build:android
```

Required values are intentionally empty in a fresh scaffold. The app reports
all missing or malformed declarations at startup instead of continuing with
placeholder endpoints.

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

## Store release

CI is **not** generated by default, because the release pipeline needs an
upload keystore and a Play service account that a new project does not have
— it would fail on every push until both exist. Add it when you are ready to
ship, from the project root:

```sh
npx create-eigen-game add ci
```

That writes `.github/workflows/checks.yml` and `release.yml`. (Passing
`--ci` at scaffold time does the same thing up front.)

`release.yml` builds a signed, obfuscated Android App
Bundle on every push to `main` and uploads it to the Play Store internal
track via `app/fastlane`. `checks.yml` is the PR gate it
calls first — it needs no secrets, since `app-config.json`,
`firebase_options.dart` and `google-services.json` are public app
identifiers, not credentials. Commit them for real once
`{{PACKAGE_MANAGER}} run firebase:configure` has been run, rather than
reconstructing them from secrets on every build. The full reasoning is at
https://eigeninteractive.com/docs/ship-it/configure and
https://eigeninteractive.com/docs/ship-it/store-release.

Only five things are genuinely secret, so only five repository secrets are
required:

| Secret | Used for |
|---|---|
| `KEYSTORE_BASE64` | The upload keystore, base64-encoded (`base64 -i upload-keystore.jks`) |
| `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` | Signing `android/key.properties` |
| `GOOGLE_PLAY_JSON_KEY` | A Play service account JSON with the *Release* permission, for `fastlane`'s `upload_to_play_store` |

Per-app one-time setup: create an upload keystore, add the four signing
secrets above, create the Google Play service account and add its JSON, and
do the **first** Play Console upload by hand to create the listing —
everything after that flows through `fastlane android internal` /
`fastlane android production`. The Fastlane lanes upload the binary only
(`skip_upload_metadata`/`images`/`screenshots`), so the store listing stays
hand-maintained in the Console.

### Replace the placeholder branding

A fresh scaffold is already branded — with the **EigenInteractive mark**, not
this game's. The launcher icon, splash and web icons were generated at scaffold
time so the
app looks finished from the first run, but shipping them to a store would put
the engine's mark on your listing. Replace them before a first release:

| Asset | What it is |
|---|---|
| `assets/icon/icon.png` | 1024×1024 launcher icon, full bleed |
| `assets/icon/icon_foreground.png` | 1024×1024 Android adaptive foreground, transparent, artwork inside the centre 66% |
| `assets/icon/splash.png` / `splash_dark.png` | Splash artwork for light and dark |

The notification icon is the exception: `eigen_flutter` ships a default
`ic_notification` drawable, so nothing is missing and nothing breaks if you
leave it. To use your own, add
`android/app/src/main/res/drawable/ic_notification.xml` — a monochrome
`<vector>`, not an SVG. Android resource merging gives your app precedence
over the package, so there is nothing to delete or override explicitly.

Also update the palette in `pubspec.yaml` — `adaptive_icon_background` and the
`flutter_native_splash` colours are the EigenInteractive ink/paper pair, which
will not suit different artwork. Then regenerate:

```bash
dart run flutter_launcher_icons
dart run flutter_native_splash:create
```

The full checklist is at https://eigeninteractive.com/docs/ship-it/branding.

Versioning uses [`cider`](https://pub.dev/packages/cider) against
`app/pubspec.yaml` and `app/CHANGELOG.md`:

```bash
dart pub global activate cider        # once, from app/
cider log added "New feature description"
cider bump patch                      # 1.0.0 -> 1.0.1
```

The build number is set from `github.run_number` in CI and is not managed by
hand. Worker deployment is unaffected by any of this — it stays the manual
`{{PACKAGE_MANAGER}} run deploy` described above.
