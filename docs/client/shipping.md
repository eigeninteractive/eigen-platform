---
sidebar_position: 8
title: Shipping an app
description: Environment, Firebase setup, deep links, branding assets, Android hardening, CI, versioning and the store release.
---

# Environment & configuration

An app's runtime configuration is one `AppConfig` passed to `runEngineApp`:
`Branding` (app name, seed colour) plus `EngineConfig` (the injected runtime
values). Nothing is read from `Env` inside the framework — the app owns its env
plumbing and hands values in, which is what lets the framework stay app-agnostic.

`.env` (git-ignored, read by `envied`; regenerate with
`dart run build_runner build` after any change):

| Var | Required | Purpose |
|---|---|---|
| `API_BASE_URL` | **yes** | Origin of the Eigen server — scheme + host only, **no path, no trailing slash**. Routes carry their own `/api/engine` prefix; the socket is this origin with `ws`/`wss`. |
| `GOOGLE_WEB_CLIENT_ID` | yes | Google Sign-In. |
| `APP_HOST` | optional | This game's public host (a subdomain, or a customer's own domain). One host for everything: invite/replay deep links, the waiting-room QR code, and — when the worker has `site` configured — the terms/privacy tiles and landing page. All of these are hidden when unset. |
| `FIREBASE_VAPID_KEY` | optional | FCM Web Push (web only). |

## Firebase setup (once per deployment)

Firebase is mandatory — the app will not compile without `firebase_options.dart`,
even for local development.

1. **Create the project** at console.firebase.google.com with Analytics enabled.
2. `npm i -g firebase-tools && firebase login`, then
   `dart pub global activate flutterfire_cli`, then **`flutterfire configure`** —
   it registers the Android and iOS apps for you; you do not add them by hand.
3. **Add SHA fingerprints** to the Android app — `flutterfire` does *not* do this,
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
4. Enable **Crashlytics** (Build → Crashlytics → Get started) and verify **Cloud
   Messaging** is on.
5. **iOS push:** create an APNs `.p8` key at developer.apple.com (Keys → Apple
   Push Notifications service), note the Key ID and Team ID, and upload it under
   Project Settings → Cloud Messaging → Apple app configuration. In Xcode, add the
   **Push Notifications** and **Background Modes → Remote notifications**
   capabilities to the Runner target.
6. **Server-side push credentials:** Project Settings → Service Accounts →
   Generate new private key. The server needs only `client_email` and
   `private_key` from that JSON — set them as Worker secrets and **delete the
   downloaded file**; it grants full Firebase Admin access.

These four generated files are **gitignored and must never be committed** — they
are instance-specific:

| File | Platform |
|---|---|
| `lib/firebase_options.dart` | Dart, all platforms |
| `android/app/google-services.json` | Android native |
| `ios/Runner/GoogleService-Info.plist` | iOS native |
| `firebase.json` | FlutterFire CLI metadata — **not** needed in CI |

Because they're gitignored, CI must reconstruct them.

## Deep links & domain configuration

The **server** hosts the verification files: it generates
`/.well-known/assetlinks.json` (Android) and `apple-app-site-association` (iOS)
from its `deepLink` config, and serves the `/join/{shortCode}` landing page. The
**client** must declare the same host so an installed app intercepts the link.

The app owns **two path prefixes** on this host: `/join/{code}` (invite/share
links) and `/game/{id}` (replay links, and a push notification's deep link).
Everything else the worker serves on the host — `/`, `/terms`, `/privacy`,
`/delete-account` — is deliberately *not* claimed, so it opens in the browser.

`APP_HOST` is therefore declared in **three places that must stay in sync**,
because the OS verifies domain ownership at install time from a value compiled
into the binary:

1. **`.env`** — `APP_HOST=mygame.example.com`, then regenerate envied.
2. **`android/app/src/main/AndroidManifest.xml`** — `android:host` **and a
   `android:pathPrefix` for each of `/join` and `/game`** in the App Links
   `<intent-filter>`. Android fetches `https://<host>/.well-known/assetlinks.json`
   at install; a mismatch silently falls back to the browser.

   The path prefixes are not optional. `assetlinks.json` declares
   `handle_all_urls`, so the *host* is verified as a whole and the
   `<intent-filter>` is the only thing that decides which paths the app claims.
   Without the prefixes the app claims **every** path on the host — including the
   server's `/terms`, `/privacy` and `/delete-account` pages — and the OS hands
   them to a router that has no such route. iOS needs no separate step: the
   server's AASA already scopes Universal Links to `paths: ["/join/*", "/game/*"]`.
3. **`ios/Runner/Runner.entitlements`** — `applinks:mygame.example.com`. **The
   entitlements file alone is not enough**: open Xcode → Runner target → Signing
   & Capabilities and confirm Associated Domains lists it; if stale, remove and
   re-add.

Plus the server's `deepLink` block, which must carry the **release** signing
cert's SHA-256 — not the upload key's, and not the debug key's.

**Android and iOS changes require a new app release** (the host is baked in);
server changes take effect on deploy. Coordinate them.

Verify before submitting: the
[Google Digital Asset Links validator](https://developers.google.com/digital-asset-links/tools/generator)
for Android and an AASA validator for iOS. The usual failures are a fingerprint
that doesn't match the signing keystore, an iOS Team ID mismatch, or the
verification file being served through a redirect.

:::info Legal pages live on `APP_HOST` — there is no separate legal host

They used to need a different domain: App Links covered the whole of `APP_HOST`,
so a `/terms` URL built on it was intercepted and handed to a router with no such
route. Two things removed that constraint — the server's `site` config serves
`/terms`, `/privacy` and `/delete-account` on the game's own host, and the
intent-filter above claims only the `/join` and `/game` prefixes. Legal URLs
therefore fall outside the claimed paths and open in the browser.

**The path prefixes are what make this safe.** An app shipped without them
intercepts its own legal links, and because the host is compiled into the binary,
fixing that needs a new release. If you would rather host legal pages on a
separate domain — for example one canonical policy shared across several games —
just point the app's terms/privacy links there instead; nothing in the engine
requires them to be on `APP_HOST`.

:::

## Branding assets

All app-owned — the engine ships no branding, because it has no app to ship.
Author the marks in any vector tool and export the PNG sources; every
platform-specific size is generated.

### App icon

Two 1024 × 1024 PNGs in `assets/icon/` — build-time inputs, so they are *not*
declared under `flutter: assets:`:

| File | Notes |
|---|---|
| `icon.png` | Full square icon, artwork edge-to-edge, opaque. Used for iOS, macOS, web and the legacy Android icon. iOS rejects alpha — set `remove_alpha_ios: true` if the source has any. |
| `icon_foreground.png` | Adaptive-icon foreground: the mark alone on **transparent**, inside the inner ~66%. Android masks it to a circle/squircle and parallaxes it, so anything near the edge is cropped. Also reused as the splash image. |

`dart run flutter_launcher_icons` writes the Android mipmaps + adaptive XML, the
iOS/macOS appiconsets, and the web favicon/icons plus the `icons` array in
`manifest.json`. It never touches `web/index.html`, and it does **not** generate
the [notification icon](./push.md#the-android-notification-icon).

### Splash

`flutter_native_splash:` is a **top-level** pubspec key, not nested under
`flutter:`. The reference app reuses `icon_foreground.png` as the splash image so
the splash mark and the home-screen icon are the same file. Regenerate with
`dart run flutter_native_splash:create` after any config or asset change.

Two things to know:

- **On Android 12+ the `image:` key is ignored entirely** — the platform builds
  the splash from the adaptive launcher icon, so the `android_12:` block only
  sets colours. And `-v31` is a *minimum*-version qualifier: that block covers
  API 31 and everything after, not just Android 12.
- **Colours can't read Dart.** `color` / `color_dark` must be kept in sync by hand
  with the theme's surface colours derived from `Branding.seedColor`; a seed
  change means editing them and regenerating.

For a splash mark that differs from the launcher icon, add
`assets/splash/logo.png` (+ `logo_dark.png`) at 1152 × 1152 with artwork inside
the inner 640 px — the outer ring is cropped by Android 12's circular mask.

### Web

A fresh Flutter app ships template values that fail silently: `<title>` is the
project name, the description is "A new Flutter project.", and `manifest.json`
carries Flutter's default `#0175C2`. Replace all of them.

Flutter's web template also has **no Open Graph tags**, so a pasted link renders
as a bare URL. Add `og:*` and `twitter:*` to `<head>`, with `og:image` an
**absolute** URL at 1200 × 630 (`web/og-image.png`) — a relative `og:image` is the
usual reason a preview renders blank, since scrapers don't resolve them. Keep text
centred; some clients crop to a square. Verify with the Facebook Sharing Debugger
after deploying, and re-scrape after changes — both it and Slack cache hard.

*(This is the app's own branding. The **server** renders the per-game share card
at `/join/{code}` from the D1 summary — a different surface.)*

### Reusing these assets on the game's website

The game Worker's `site` config serves a landing page, legal pages and a web
manifest on the game's own host, and it needs exactly the files this section
already produces — **no second icon set, and no extra artwork**. The engine's
default paths are the names `flutter_launcher_icons` emits, so the whole step is
copying `web/` output into the Worker's `public/`:

| This app generates | Copy to the Worker's `public/` | Used for |
|---|---|---|
| `web/favicon.png` | `favicon.png` | Browser tab |
| `web/icons/Icon-192.png` | `icons/Icon-192.png` | Manifest, apple-touch-icon |
| `web/icons/Icon-512.png` | `icons/Icon-512.png` | Manifest |
| `web/icons/Icon-maskable-192.png` | `icons/Icon-maskable-192.png` | Manifest (maskable) |
| `web/icons/Icon-maskable-512.png` | `icons/Icon-maskable-512.png` | Manifest (maskable) |
| `web/og-image.png` | `og-image.png` | Landing-page share card |

All of them derive from the same `assets/icon/icon.png`, except `og-image.png`,
which is the one hand-made 1200 × 630 image this section already asks for. If
you host the Worker on a different origin, the `og:image` it emits is absolute
and built from the request origin, so nothing needs rewriting.

### Checklist

- [ ] `assets/icon/icon.png` + `icon_foreground.png` at 1024 × 1024, foreground
      inside the inner ~66%
- [ ] `flutter_launcher_icons:` adaptive background matches the brand → regenerate
- [ ] `flutter_native_splash:` colours match the theme → regenerate
- [ ] `ic_notification.xml` replaced with this app's monochrome silhouette
- [ ] `web/index.html`: real title + description + OG/Twitter tags, absolute
      `og:image`; `web/og-image.png` at 1200 × 630
- [ ] `web/manifest.json`: real `name`, `short_name`, `description`,
      `background_color` / `theme_color`
- [ ] `web/` icons + `og-image.png` copied into the game Worker's `public/`
- [ ] App Links `<intent-filter>` carries an `android:pathPrefix` for both
      `/join` and `/game`

## Android release hardening

Two independent mechanisms; enable both.

**R8** (`isMinifyEnabled` + `isShrinkResources` in `android/app/build.gradle.kts`)
shrinks and obfuscates the Java/Kotlin layer. Only libraries that don't ship
their own consumer rules need entries in `proguard-rules.pro` — the Flutter
engine, Play Core (`in_app_update`/`in_app_review`), `google_sign_in`, and
`image_cropper` all bring their own, so the file stays nearly empty by design.
Adding redundant `-keep` rules there is how it rots.

**Dart obfuscation** is a Flutter tool flag, not a Gradle setting — it belongs in
the CI build command:

```bash
flutter build appbundle --release \
  --obfuscate --split-debug-info=build/debug-info/android/
```

Symbol upload splits accordingly: the **R8/ProGuard mapping** is uploaded
automatically by the `firebase-crashlytics-gradle` plugin during the build (as
long as `google-services.json` is present), while **Dart deobfuscation symbols**
are a separate artifact — CI uploads `build/debug-info/` as a workflow artifact.
Without them a release stack trace is unreadable, so keep the retention long
enough to outlive a release.

## CI

Three workflows across the two repos, all Flutter-side:

**`eigen-flutter/.github/workflows/flutter.yml`** — analyze + test the framework
in isolation, so `main` stays green for dependent apps. Needs no secrets: the
framework reads no `Env`/Firebase config itself (apps inject it). The sequence is
`pub get` → format check → `build_runner build` → `dart fix --apply` →
**`git diff --exit-code`** → analyze → test. That diff check is the load-bearing
step — it fails the build if generated code or applied fixes weren't committed.

**The app's `android.yml`** — the app pipeline, in three jobs:

- **test** — checks out *both* repos as siblings, runs `build_runner` in
  the **engine first** so its generated code exists, writes `.env` from secrets,
  decodes `firebase_options.dart`, then format/analyze/test.
- **build** (main pushes only) — decodes `google-services.json` and the keystore,
  writes `android/key.properties`, builds a signed obfuscated AAB with
  `--build-number=${{ github.run_number }}`, and uploads the AAB and the debug
  symbols as artifacts.
- **deploy** — downloads the AAB and runs `bundle exec fastlane android internal`.

The **path dependency is the reason for the two-repo checkout**: `eigen_flutter`
is consumed by path in local *and* CI until it is published, so CI has to
reproduce the sibling layout that local development uses.

Required GitHub Actions secrets:

| Secret | Used for |
|---|---|
| `API_BASE_URL`, `GOOGLE_WEB_CLIENT_ID`, `APP_HOST` | written into `.env` |
| `FIREBASE_OPTIONS_DART_BASE64` | `lib/firebase_options.dart` (needed in **test** too, or analyze can't resolve the import) |
| `GOOGLE_SERVICES_JSON_BASE64` | `android/app/google-services.json` (build only) |
| `GOOGLE_SERVICE_INFO_PLIST_BASE64` | iOS equivalent, when iOS CI is added |
| `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` | signing |
| `GOOGLE_PLAY_JSON_KEY` | fastlane `upload_to_play_store` |

Encode with `base64 -i <file> | pbcopy`. `firebase.json` is **not** a CI secret —
it is only used by the `flutterfire` CLI to target the right project on the next
`configure` run, and is never read by a build.

## Compatibility & versioning

Once an app ships, client and server **stop moving together**: a shipped binary
keeps calling a newer backend for weeks, and a daily-timed game can outlive
several releases. Every change must answer *"what does an old client, and an
in-flight game started under the old rules, do when they meet the new code?"*

Three independent version axes:

| Axis | Granularity | Where it lives |
|---|---|---|
| **Package version** | per release | `pubspec.yaml`, git tag |
| **Game schema version** | per game-type revision | `schema_version` on the game row — selects the `GameRules` unit on both sides |
| **Cache schema version** | per persisted model | each provider's `destroyKey` |

### Game schema — version the type, don't mutate games

A breaking rules or payload change never mutates existing games. Each game is
**stamped with the schema version it was created under**, honoured for its whole
life. Neither side branches — each ships another unit under another key.

Client gating: the frame provider looks the game's version up in
`GameModule.versions` and raises `UnsupportedGameSchemaException` rather than
mis-parsing with old code. The **join is gated too**, server-side, so an
unsupported game is refused before a seat is created — not only when the screen
later fails to render. The lobby additionally disables the Join button as
immediate feedback.

:::warning Retiring an old unit splits into two lifetimes

- The **write path** (anything that advances state — TS `applyAction`,
  `applyLifecycle`) can go once active games at that version have drained.
- The **read/render path** (TS `computeObservation`, Dart `parseObservation` +
  rendering) must survive **as long as you want to replay games created under
  that schema** — which is *not* bounded by draining. Replay re-projects historic
  transitions at the game's own version.

**Draining gates the write path; replay gates the read path, and replay outlives
draining.**

:::

### Wire compatibility — closed enums, not tolerant decode

The Supabase-era client used `unknown` enum sentinels so an unrecognised value
degraded gracefully. **That is deliberately gone.** Generated enums parse
strictly, so an unknown value throws and `test/shared/api_contract_test.dart`
pins the sets.

The trade: graceful degradation on the wire buys silence, and silence is exactly
wrong when the two sides are two repos with one generated seam between them. With
closed enums, adding a value server-side breaks the client **build** — loudly, in
CI, before release — instead of producing a screen that renders nothing at
runtime. That makes adding a wire enum member a coordinated, schema-version-bumped
change, which it always was in truth.

Within a version, additive change is still fine: new fields must be nullable or
`@Default(...)`, never `required`. Changing a field's type or meaning, or removing
it, is breaking → new unit.

### Cache compatibility

A cached-row decode failure must be a **cache miss** (drop, refetch), never a
crash — that is the safety net when a persisted row predates a `destroyKey` bump.
`SharedPreferences` reads must default safely; if a key's value shape changes,
write under a **new key** rather than reinterpreting the old one.

### "I want to change the game" — the checklist

- Alters the observation/action/config shape, or makes in-flight games
  inconsistent? → **breaking**: new `GameRules` unit on both sides + fixtures;
  drain before retiring the write path.
- Purely additive (a new optional field)? → nullable / `@Default`, **no bump**.
- Server-only rule logic, same shapes? → change `applyAction` only, **no bump**.
- New wire enum value? → **breaking**; bump and ship both sides together.
- Persisted model's shape changed? → bump **that provider's** `destroyKey`.

## Store release

Store packaging is app-owned.

- **`fastlane/`** — a `Fastfile` with `android internal` and `android production`
  lanes (`upload_to_play_store` with the built AAB), an `Appfile` with the
  `package_name`, and a `Gemfile` pinning the fastlane gem.
- **Per-app setup** — create an upload keystore and add the four signing secrets;
  create a Google Play service account with the *Release* permission and add its
  JSON as `GOOGLE_PLAY_JSON_KEY`; set `applicationId` / bundle id as the app's own
  store identity. **The first upload must be done by hand in the Play Console** to
  create the listing; everything after flows through fastlane.
- iOS submission is **not wired** — add an `ios` lane when targeting iOS.

**The lanes upload the binary only.** Both pass `skip_upload_metadata`,
`skip_upload_images`, and `skip_upload_screenshots`, so the listing (icon,
feature graphic, screenshots, description) is maintained by hand in the Console
and CI will never overwrite it. That is deliberate — store copy changes on a
different cadence than code. To flip it, drop assets into
`fastlane/metadata/android/en-US/images/` and remove the matching `skip_upload_*`
flags; from then on the repo is the source of truth and fastlane overwrites
Console edits.

Play's asset requirements (512 × 512 icon, 1024 × 500 feature graphic, ≥ 2 phone
screenshots) tighten periodically — confirm against Google's current spec before
a first submission rather than trusting a copy of it. There is no screenshot
automation; capture from an emulator at a qualifying resolution with
`adb exec-out screencap -p > shot.png`, using a seeded account with realistic
games in progress.
