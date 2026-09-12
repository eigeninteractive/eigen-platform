# Upstream blockers

Upstream limitations that force temporary compatibility code in the
EigenInteractive platform. This is for engine maintainers, not game
implementors.

Keep each entry only while its workaround exists. Re-check the upstream state
and update the **Last checked** date whenever planning dependency or platform
upgrades.

- [Flutter Android built-in Kotlin migration](#flutter-android-built-in-kotlin-migration)
- [Flutter SDK dartdoc `@docImport` crash](#flutter-sdk-dartdoc-docimport-crash)
- [FlutterFire Firebase Installation ID registration API](#flutterfire-firebase-installation-id-registration-api)

## Flutter Android built-in Kotlin migration

**Status:** Blocked on a compatible `in_app_review` release. **Last checked:**
2026-09-13.

Flutter 3.47.4 is now stable and can enable Gradle's built-in Kotlin support,
but `in_app_review` remains at 2.0.12 and still applies `kotlin-android`
unconditionally. The platform remains on its tested Flutter 3.44.8
compatibility path with `android.builtInKotlin=false` and
`android.newDsl=false`; enabling built-in Kotlin waits until the dependency
graph can migrate together.

This is not the only thing holding the Flutter pin at 3.44.8. The dartdoc
crash below gates the same pin independently, and clearing one does not clear
the other.

The other resolved Android plugins checked during the initial investigation
already conditionally avoid applying the legacy Kotlin plugin when built-in
Kotlin is enabled. Do not force the new mode while one plugin still applies the
old plugin.

### Unblock and remove

1. Wait for or contribute an `in_app_review` release that supports built-in
   Kotlin.
2. Upgrade `in_app_review` and the platform Flutter SDK together. The current
   `^2.0.11` constraint accepts a compatible 2.x release; change it if support
   first ships in a new major version.
3. Follow Flutter's application and plugin migration guides: enable built-in
   Kotlin, remove the temporary opt-out properties, and remove obsolete Kotlin
   plugin/version declarations from generated Android apps.
4. Regenerate a game with `create-eigen-game`, then run analysis, tests, and
   Android debug and release builds without legacy Kotlin warnings.

References:

- [Flutter app migration](https://docs.flutter.dev/release/breaking-changes/migrate-to-built-in-kotlin/for-app-developers)
- [Flutter plugin migration](https://docs.flutter.dev/release/breaking-changes/migrate-to-built-in-kotlin/for-plugin-authors)
- [`in_app_review` on pub.dev](https://pub.dev/packages/in_app_review)

## Flutter SDK dartdoc `@docImport` crash

**Status:** Blocked on a Dart SDK carrying dartdoc 9.0.8 or newer. **Last
checked:** 2026-09-13.

`./tool/check.sh flutter` runs `dart doc --dry-run .` in `flutter/`, `shell/`
and `firebase/`. On Flutter 3.47.x all three abort before documenting anything:

```
DocumentationComment._stripDocImports (package:dartdoc/src/model/documentation_comment.dart:931)
RangeError (end): Invalid value: Only valid value is 79: 80
```

The platform's own doc comments are not the cause. `_stripDocImports` returns
immediately unless a comment carries `@docImport` source ranges, and the
platform declares no `@docImport` anywhere. The ranges arrive on doc comments
*inherited* from dependencies, which dartdoc 9.0.6 then slices against the
wrong string. dartdoc 9.0.8 fixes exactly this: "Fix a `RangeError` caused by
string offset drift when parsing `@docImport`". Running dartdoc 9.0.9
standalone against the same Dart 3.13.1 documents all three packages with no
errors, which is what identifies the bundled tool, rather than the SDK or the
sources, as the cause.

Upgrading Flutter does not currently help. Dart 3.13.1 and 3.13.3 pin the same
`dartdoc_rev`, `1d56f263955f329b6701d8f84f069eb0aef353a4`, whose pubspec reads
`9.0.6-wip`, so Flutter 3.47.1 through 3.47.4 all carry the crash. The Dart SDK
`main` branch pins 9.0.9, so the fix arrives with a later SDK.

The platform therefore stays on Flutter 3.44.8, pinned in `flutter/.fvmrc` and
in the scaffold template's own `.fvmrc`, where dartdoc is unaffected and CI is
green.

Working on a newer Flutter locally is fine for everything except `dart doc`.
Run that out of band instead:

```bash
dart pub global activate dartdoc 9.0.9
dart pub global run dartdoc --no-generate-docs --input=flutter --output=/tmp/dartdoc
```

### Unblock and remove

1. Watch for a Dart SDK whose pinned dartdoc is 9.0.8 or newer, and the Flutter
   release carrying it:

   ```bash
   curl -s https://raw.githubusercontent.com/dart-lang/sdk/<version>/DEPS |
     grep dartdoc_rev
   ```

   Resolve the revision through
   `https://raw.githubusercontent.com/dart-lang/dartdoc/<rev>/pubspec.yaml`.

2. Confirm `dart doc --dry-run .` succeeds in `flutter/`, `shell/` and
   `firebase/` on that SDK.
3. Raise `flutter/.fvmrc` and
   `server/packages/create-eigen-game/templates/app-overlay/.fvmrc` together
   with the built-in Kotlin migration above, not ahead of it.
4. Remove this entry.

References:

- [dartdoc changelog](https://pub.dev/packages/dartdoc/changelog)
- [Dart SDK `DEPS`](https://github.com/dart-lang/sdk/blob/main/DEPS)
- [Flutter stable releases](https://docs.flutter.dev/release/archive)

## FlutterFire Firebase Installation ID registration API

**Status:** Blocked until FlutterFire publishes the proposed API. **Last
checked:** 2026-09-10.

[Issue #18479](https://github.com/firebase/flutterfire/issues/18479) and
[PR #18482](https://github.com/firebase/flutterfire/pull/18482) remain open.
`firebase_messaging` 16.6.0 has shipped without the proposed FID-based
`register`, `unregister`, `onRegistered`, and `onUnregistered` operations.
Token-only FlutterFire APIs are not an adequate replacement because Eigen uses
the Firebase Installation ID as its server-side installation identity.

### Current compatibility seam

Keep the workaround narrow inside `eigen_firebase`:

- `FirebaseMessagingRegistration` is the removable interface used by the
  notification service.
- The native implementation enables messaging auto-init and reads the current
  FID through `firebase_app_installations`.
- The web implementation calls the official Firebase Messaging JavaScript
  registration APIs through Dart JS interop.
- The Android library manifest enables FID registration, while the plugin
  Gradle build supplies the required native Firebase dependency.

Do not spread direct JS interop or native SDK handling into application
features.

### Unblock and remove

1. Confirm the FlutterFire PR is merged and identify the first published
   `firebase_messaging` version containing the API.
2. Upgrade the compatible FlutterFire package set together.
3. Replace `FirebaseMessagingRegistration` with the released FlutterFire API.
4. Remove the adapter, platform implementations, Android manifest metadata,
   direct native dependency, and `firebase_app_installations` only where the
   released implementation makes each unnecessary.
5. Test Android and web registration, registration/unregistration events,
   guest-to-account upgrades, sign-out and account deletion, foreground and
   background delivery, and server-side installation reconciliation.
6. Generate and build a fresh game scaffold to confirm that implementors do not
   inherit additional Firebase or Android configuration.

References:

- [FlutterFire issue #18479](https://github.com/firebase/flutterfire/issues/18479)
- [FlutterFire PR #18482](https://github.com/firebase/flutterfire/pull/18482)
- [`firebase_messaging` on pub.dev](https://pub.dev/packages/firebase_messaging)
