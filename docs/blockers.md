# Upstream blockers

Upstream limitations that force temporary compatibility code in the
EigenInteractive platform. This is for engine maintainers, not game
implementors.

Keep each entry only while its workaround exists. Re-check the upstream state
and update the **Last checked** date whenever planning dependency or platform
upgrades.

- [Android built-in Kotlin migration](#android-built-in-kotlin-migration)
- [Dart SDK ships a crashing dartdoc](#dart-sdk-ships-a-crashing-dartdoc)
- [Drift does not persist IndexedDB transactions](#drift-does-not-persist-indexeddb-transactions)
- [FlutterFire Firebase Installation ID registration API](#flutterfire-firebase-installation-id-registration-api)

## Android built-in Kotlin migration

**Status:** Blocked on plugin releases. Does **not** block the Flutter SDK
version. **Last checked:** 2026-09-14.

Gradle's built-in Kotlin support cannot be enabled while a resolved plugin still
applies the Kotlin Gradle Plugin itself. Flutter names them during a release
build:

```
WARNING: Your app uses the following plugins that apply Kotlin Gradle Plugin (KGP):
app_settings, firebase_analytics, firebase_app_installations, firebase_auth,
firebase_core, firebase_crashlytics, in_app_review
Future versions of Flutter will fail to build if your app uses plugins that apply KGP.
```

Seven plugins, six of them Firebase. Every one is already at its newest release,
so there is nothing to upgrade to yet.

Two things this entry used to say that were wrong, and are worth not repeating.
It claimed the other resolved plugins were already guarded; Flutter's own list
above is the authority, and it is longer. And it treated this as the reason the
platform could not move off Flutter 3.44.8 -- it is not. Built-in Kotlin is
opt-in today, the repository sets no `gradle.properties` at all, and a release
APK builds clean on Flutter 3.47. **The SDK moved; this did not have to.**

The deadline is real but not yet: a future Flutter will make KGP usage a build
failure rather than a warning. `in_app_review` is the only one of the seven the
platform could drop unilaterally -- one dependency line, one 58-line file, one
call site -- and dropping it alone changes nothing while six remain.

### Unblock and remove

1. Watch the seven plugins for releases supporting built-in Kotlin. The Firebase
   six move together, so FlutterFire is the one to watch.
2. When all seven have shipped, enable built-in Kotlin, regenerate a scaffold,
   and build Android debug and release without the KGP warning.
3. Remove this entry.

References:

- [Flutter app migration](https://docs.flutter.dev/release/breaking-changes/migrate-to-built-in-kotlin/for-app-developers)
- [Flutter plugin migration](https://docs.flutter.dev/release/breaking-changes/migrate-to-built-in-kotlin/for-plugin-authors)

## Dart SDK ships a crashing dartdoc

**Status:** Worked around with a pinned dartdoc. **Last checked:** 2026-09-14.

`dart doc` crashes on any package whose dependencies carry `@docImport` doc
comments:

```
DocumentationComment._stripDocImports (package:dartdoc/src/model/documentation_comment.dart:931)
RangeError (end): Invalid value: Only valid value is 79: 80
```

The platform declares no `@docImport` anywhere; the ranges arrive on doc comments
inherited from dependencies, and dartdoc 9.0.6 slices them against the wrong
string. dartdoc 9.0.8 fixes it -- "Fix a `RangeError` caused by string offset
drift when parsing `@docImport`".

Upgrading the SDK does not help. Dart 3.13.1 and 3.13.3 pin the same
`dartdoc_rev` (`1d56f263...`, whose pubspec reads `9.0.6-wip`), so every current
stable ships the bug.

So the tool is pinned instead of waited for: the workspace root declares
`dartdoc: 9.0.8` and `tool/check.sh` runs that rather than `dart doc`. 9.0.8
rather than the newer 9.0.9 because 9.0.9 wants analyzer ^14.1.0, and
`flutter_test` from the SDK pins `matcher`, which pins `test`, which caps
analyzer below 14.

### Unblock and remove

1. Watch for a Dart SDK whose pinned dartdoc is 9.0.8 or newer:

   ```bash
   curl -s https://raw.githubusercontent.com/dart-lang/sdk/<version>/DEPS | grep dartdoc_rev
   ```

   Resolve the revision through
   `https://raw.githubusercontent.com/dart-lang/dartdoc/<rev>/pubspec.yaml`.

2. Confirm `dart doc --dry-run .` succeeds in `flutter/`, `shell/` and
   `firebase/` on that SDK.
3. Drop the `dartdoc` dev dependency from the root `pubspec.yaml`, restore
   `dart doc --dry-run .` in `tool/check.sh`, and remove `check_docs`.
4. Remove this entry.

References:

- [dartdoc changelog](https://pub.dev/packages/dartdoc/changelog)
- [Dart SDK `DEPS`](https://github.com/dart-lang/sdk/blob/main/DEPS)

## Drift does not persist IndexedDB transactions

**Status:** Worked around in `eigen_flutter`; fixed upstream, unreleased.
**Last checked:** 2026-09-17.

Drift's IndexedDB storage (`sharedIndexedDb`, `unsafeIndexedDb`) keeps the
database in memory and saves pending writes to IndexedDB only after a statement
runs outside a transaction. In drift 2.35.0 two writes are never followed by
one:

- A transaction's `COMMIT` runs while drift still considers itself inside the
  transaction, so nothing a transaction wrote is saved until some later,
  unrelated statement. Almost every replica write is a transaction, including
  each move of a local game, which exists nowhere else until it is uploaded.
- `Sqlite3Delegate.setSchemaVersion` writes the schema version after every
  migration statement and saves nothing. Lost, it makes every later open run the
  creating migration again and fail, for good.

A tab that closes in between loses the write. Reproduced in Chrome 153 with
`sharedIndexedDb`: a row inserted in a transaction was gone after closing the
only tab and reopening. IndexedDB is the storage Chrome and Safari get, because
OPFS needs either shared workers that can start dedicated workers (Firefox
only) or cross-origin isolation, which breaks the sign-in popup.

[simolus3/drift#3865](https://github.com/simolus3/drift/pull/3865) (merged
2026-09-16, fixing [#3864](https://github.com/simolus3/drift/issues/3864))
saves after a commit and after every read outside a transaction, which also
saves the schema version on the first query after opening. drift 2.35.0
(2026-09-09) is the latest release and predates it.

### Current compatibility seam

`_PersistToIndexedDb` in `flutter/lib/core/replica/replica_host_web.dart`, a
drift `QueryInterceptor` applied only to IndexedDB storage: after each outermost
commit, and once after opening, it runs one statement outside a transaction,
which is what makes drift save. Nothing else in the platform knows about it.

### Unblock and remove

1. Watch drift's releases for the first one whose changelog carries #3865:

   ```bash
   gh release list -R simolus3/drift --limit 5
   ```

2. Raise `drift` in `flutter/pubspec.yaml` to that release, and replace
   `flutter/assets/drift/sqlite3.wasm` and `drift_worker.js` with that
   release's assets. The fix runs inside the worker, so the Dart constraint alone
   changes nothing in a browser.
3. Delete `_PersistToIndexedDb` and its use in `openReplicaHost`.
4. In a browser with `sharedIndexedDb` (Chrome), write in a transaction, close
   the only tab, and reopen: the row must still be there. Repeat on a fresh
   profile with nothing written after opening: the second open must not fail.
5. Remove this entry.

References:

- [drift PR #3865](https://github.com/simolus3/drift/pull/3865)
- [drift issue #3864](https://github.com/simolus3/drift/issues/3864)
- [Architecture decision 0014](architecture/0014-web-application-shell.md)

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
