---
sidebar_position: 6
title: Store release
description: Android release hardening, the app's CI pipeline and its secrets, and the fastlane lanes that upload a binary and deliberately nothing else.
---

# Store release

Store packaging is app-owned — this page is the Android path, which is the one
that is wired. iOS submission is **not**: add an `ios` lane when you target it.

## Release hardening

Two independent mechanisms; enable both.

**R8** (`isMinifyEnabled` + `isShrinkResources` in
`android/app/build.gradle.kts`) shrinks and obfuscates the Java/Kotlin layer.
Only libraries that do not ship their own consumer rules need entries in
`proguard-rules.pro` — the Flutter engine, Play Core (`in_app_update` /
`in_app_review`), `google_sign_in` and `image_cropper` all bring their own, so
the file stays nearly empty by design. Adding redundant `-keep` rules there is
how it rots.

**Dart obfuscation** is a Flutter tool flag, not a Gradle setting, so it belongs
in the build command:

```bash
flutter build appbundle --release \
  --obfuscate --split-debug-info=build/debug-info/android/
```

Symbol upload splits accordingly. The **R8/ProGuard mapping** is uploaded
automatically by the `firebase-crashlytics-gradle` plugin during the build, as
long as `google-services.json` is present. **Dart deobfuscation symbols** are a
separate artifact that CI must upload itself — without them a release stack trace
is unreadable, so keep the retention long enough to outlive a release.

## The app's CI

Three jobs:

- **test** — checks out the app, writes `.env` from secrets, decodes
  `firebase_options.dart`, then format, analyze, test.
- **build** (main pushes only) — decodes `google-services.json` and the keystore,
  writes `android/key.properties`, builds a signed obfuscated AAB with
  `--build-number=${{ github.run_number }}`, and uploads the AAB and the debug
  symbols as artifacts.
- **deploy** — downloads the AAB and runs `bundle exec fastlane android internal`.

`FIREBASE_OPTIONS_DART_BASE64` is needed in **test** as well as build — without
it, analyze cannot resolve the import.

| Secret | Used for |
|---|---|
| `API_BASE_URL`, `GOOGLE_WEB_CLIENT_ID`, `APP_HOST` | written into `.env` |
| `FIREBASE_OPTIONS_DART_BASE64` | `lib/firebase_options.dart` |
| `GOOGLE_SERVICES_JSON_BASE64` | `android/app/google-services.json` (build only) |
| `GOOGLE_SERVICE_INFO_PLIST_BASE64` | the iOS equivalent, when iOS CI is added |
| `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` | signing |
| `GOOGLE_PLAY_JSON_KEY` | fastlane `upload_to_play_store` |

Encode with `base64 -i <file> | pbcopy`. `firebase.json` is **not** a CI secret —
it is only used by the `flutterfire` CLI to target the right project on the next
`configure` run, and is never read by a build.

## fastlane

- **`fastlane/`** — a `Fastfile` with `android internal` and `android production`
  lanes (`upload_to_play_store` with the built AAB), an `Appfile` with the
  `package_name`, and a `Gemfile` pinning the fastlane gem.
- **Per-app setup** — create an upload keystore and add the four signing secrets;
  create a Google Play service account with the *Release* permission and add its
  JSON as `GOOGLE_PLAY_JSON_KEY`; set `applicationId` and bundle id as the app's
  own store identity.
- **The first upload must be done by hand in the Play Console** to create the
  listing. Everything after that flows through fastlane.

**The lanes upload the binary only.** Both pass `skip_upload_metadata`,
`skip_upload_images` and `skip_upload_screenshots`, so the listing — icon,
feature graphic, screenshots, description — is maintained by hand in the Console
and CI will never overwrite it. That is deliberate: store copy changes on a
different cadence than code.

To flip it, drop assets into `fastlane/metadata/android/en-US/images/` and remove
the matching `skip_upload_*` flags. From then on the repo is the source of truth
and fastlane overwrites Console edits.

## Store assets

Play's requirements (512 × 512 icon, 1024 × 500 feature graphic, at least two
phone screenshots) tighten periodically — confirm against Google's current spec
before a first submission rather than trusting a copy of it.

There is no screenshot automation. Capture from an emulator at a qualifying
resolution with `adb exec-out screencap -p > shot.png`, using a seeded account
with realistic games in progress. The same shots feed the game's website via
`site.screenshots` — see [Branding & the website](./branding.md).
