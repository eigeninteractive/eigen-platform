# Upstream blockers

Upstream limitations that force temporary compatibility code in the
EigenInteractive platform. This is for engine maintainers, not game
implementors.

Keep each entry only while its workaround exists. Re-check the upstream state
and update the **Last checked** date whenever planning dependency or platform
upgrades.

- [Flutter Android built-in Kotlin migration](#flutter-android-built-in-kotlin-migration)
- [FlutterFire Firebase Installation ID registration API](#flutterfire-firebase-installation-id-registration-api)

## Flutter Android built-in Kotlin migration

**Status:** Blocked on a compatible `in_app_review` release. **Last checked:**
2026-09-10.

Flutter 3.47.3 is now stable and can enable Gradle's built-in Kotlin support,
but `in_app_review` remains at 2.0.12 and still applies `kotlin-android`
unconditionally. The platform remains on its tested Flutter 3.44.8
compatibility path with `android.builtInKotlin=false` and
`android.newDsl=false`; enabling built-in Kotlin waits until the dependency
graph can migrate together.

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
