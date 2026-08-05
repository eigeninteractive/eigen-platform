# Upstream blockers

Upstream limitations that force temporary compatibility choices, across every
Eigen repository. It is for engine maintainers, not game implementors.

One file rather than one per repository, because these are read at the same
moments — planning a release, or deciding whether an upstream package has moved
far enough to act on. A blocker in `eigen_flutter` and a blocker in the release
pipeline both answer "what are we still working around?", and splitting them by
repository only meant neither list got re-checked.

Keep each entry until its workaround has been removed, and re-check upstream
status before acting on any of them. The **Last checked** date is the point of
the entry: it says how stale the assessment is, so refresh it whenever you look,
even when nothing has changed.

- [`eigen-server`](#eigen-server)
  - [`changesets/action` sub-actions pinned to a prerelease](#changesetsaction-sub-actions-pinned-to-a-prerelease)
- [`eigen-flutter`](#eigen-flutter)
  - [Flutter Android built-in Kotlin migration](#flutter-android-built-in-kotlin-migration)
  - [FlutterFire Firebase Installation ID registration API](#flutterfire-firebase-installation-id-registration-api)

## `eigen-server`

### `changesets/action` sub-actions pinned to a prerelease

**Status:** Adopted deliberately. `release.yml` pins the `select-mode`,
`version`, `pack` and `publish` sub-actions to commit
`c47fa68bd43bb8ae0bae7e558622593deebf5955` (`v2.0.0-next.3`). Move to a stable
`v2` tag when one is published. Last checked: 2026-08-05 — still none. The line
advanced to `v2.0.0-next.4` on 2026-08-03; the newest non-prerelease is
`v1.9.0`.

These sub-actions are the only way to publish to npm with **trusted publishing**
(OIDC), which is why they were adopted before the stable release. The
alternative was an `NPM_TOKEN`: npm revoked classic tokens on 2025-12-09 and
caps granular write tokens at a 90-day lifetime, so a token would have meant a
quarterly rotation plus enabling **Bypass 2FA** on the publishing account. There
is now no npm credential anywhere in the pipeline.

That alternative is also closing. npm [restricted bypass-2FA
tokens][npm-bypass-restrict] on 2026-07-31 and has announced that they lose
direct publish access in January 2027. Trusted publishing is becoming the only
supported way to publish from CI, so this is not a preference to revisit —
only the pinned prerelease below is.

The prerelease risk is bounded rather than absent:

- **Pinned by commit, so it cannot shift underneath us.** The usual hazard of a
  `next` line does not apply.
- **Changesets runs this exact layout in production** to publish its own
  packages — 52 of its last 60 runs succeeded when checked.
- **The failures observed upstream were in pre-mode handling**
  (`ENOENT: .changeset/pre/changes.md` in `select-mode`), which only executes
  after `changeset pre enter`. This repo does not use prerelease mode.
- **Failure is fail-safe.** `gate` precedes everything and `pack` holds no
  credentials, so a broken run publishes nothing rather than publishing
  something wrong.

The known cost is that inputs are still moving: v1's `version:` input is already
renamed to `script:` on this line, and `next.4` removed `setup-git-user` and
replaced `commit-mode` with a boolean `push-with-git-cli`. Neither reaches
`release.yml`, which passes only `github-token` — the one input `next.4` now
requires to be explicit, since it stops accepting the `GITHUB_TOKEN` environment
variable and `actions/checkout` credentials as substitutes. Expect input
adjustments when migrating to stable, not a re-architecture — the four-job
topology is the part being bought, and that is settled.

This pin has a second half. `@changesets/cli` is pinned to `3.0.0-next.10`
because `select-mode` calls `changeset publish-plan`, which does not exist on
the stable 2.x line. Both move together or neither does — and `next.4` now
*enforces* that, failing outright against a v2 CLI and directing those projects
to `changesets/action@v1`. The CLI has not stabilised either: `latest` is
`2.31.1` and `next` is `3.0.0-next.11`.

#### Unblock and remove

1. Confirm a **stable** `changesets/action@v2` release exists, with a floating
   `v2` ref and published documentation (the prerelease shipped with neither).
2. Diff the sub-action `action.yml` inputs against what `release.yml` passes;
   rename as needed.
3. Replace the four pinned commits with the stable ref.
4. Move `@changesets/cli` to the matching stable release, and confirm
   `changeset publish-plan` exists there before dropping the prerelease pin.
5. Verify with a real release, not a dry run — the publish path is the one that
   cannot be exercised any other way.

#### Related constraints that are NOT blockers

Recorded so they are not re-investigated:

- A trusted publisher is configured per package on npmjs.com and requires the
  package to already exist. Handled by publishing `0.1.0` manually with
  `npm login`; pub.dev imposed the same constraint on `eigen_api` and
  `eigen_flutter`. Done for all six artifacts.
- `actions/setup-node` must never set `registry-url` in the publish job. It
  writes an `.npmrc` whose token npm prefers over an OIDC exchange, and the
  failure surfaces as a misleading `E404 ... is not in this registry`
  ([npm/cli#8976][npm-cli-8976]).
- `pnpm` publishing under OIDC once 404'd ([pnpm#11513][pnpm-11513]); the cause
  was a stale `pnpm/action-setup`, fixed well before the v6.0.9 pinned here.
- Provenance requires this repository to stay **public**. npm refuses to sign
  provenance from a private source repo.
- pub.dev's automated publishing trusts an OIDC token only when its ref is a
  **tag**. Branch refs were requested in [dart-lang/pub-dev#8507][pub-dev-8507]
  and closed as won't-fix, so `eigen_api` publishing stays in its own
  tag-triggered workflow. Permanent, not pending.

Upstream references:

- [npm: trusted publishers][npm-trusted]
- [npm: classic tokens revoked][npm-classic-revoked]
- [Changesets' own publish workflow][cs-publish-yml]
- [changesets/action#515 — separate publish workflow for OIDC][ca-515]

## `eigen-flutter`

### Flutter Android built-in Kotlin migration

**Status:** Blocked on a compatible `in_app_review` release and a project
upgrade to Flutter 3.47 or later. Last checked: 2026-08-05 — neither has moved.
`in_app_review` is still 2.0.12 (published 2026-05-15), and 3.47 has not reached
stable: the current stable is 3.44.8 and 3.47 exists only on beta
(`3.47.0-0.3.pre`).

Flutter is migrating Android apps and plugins from the separately applied
Kotlin Gradle plugin to Gradle's built-in Kotlin support. The workspace
currently uses Flutter 3.44.8 and remains on Flutter's supported compatibility
path with `android.builtInKotlin=false` and `android.newDsl=false`.

The resolved Android plugin state is:

- `in_app_review` 2.0.12 still applies `kotlin-android` unconditionally. This is
  the dependency that currently prevents enabling built-in Kotlin.
- `app_settings` 8.0.3 and `firebase_analytics` 12.4.5 already conditionally
  avoid applying the legacy Kotlin plugin when built-in Kotlin is enabled.
  They do not require an upgrade for this migration at the versions currently
  resolved.
- Flutter only supports an app opting in to built-in Kotlin from Flutter 3.47.

Do not suppress the warnings by forcing built-in Kotlin on the current Flutter
SDK. That would select an unsupported configuration while
`in_app_review` is still incompatible.

#### Unblock and remove

1. Wait for or contribute an `in_app_review` release that supports Flutter's
   built-in Kotlin mode.
2. Upgrade `in_app_review`. The current `^2.0.11` constraint will accept a
   compatible 2.x release; change the constraint if support first ships in a
   new major version.
3. Upgrade the development and CI Flutter SDKs to 3.47 or later. The pinned
   version is `eigen-flutter/.fvmrc`, which CI reads through
   `flutter-version-file` — changing it moves both at once.
4. Follow Flutter's app migration guide: enable built-in Kotlin, remove the
   temporary opt-out properties, and remove obsolete Kotlin plugin/version
   declarations from generated Android apps.
5. Regenerate a game with `create-eigen-game`, then run analysis, tests, and an
   Android debug and release build. The build must complete without legacy
   Kotlin plugin warnings.

Upstream references:

- [Flutter: migrate an Android app to built-in Kotlin][flutter-app-kotlin]
- [Flutter: migrate an Android plugin to built-in Kotlin][flutter-plugin-kotlin]
- [`in_app_review` on pub.dev][in-app-review]

### FlutterFire Firebase Installation ID registration API

**Status:** Blocked until FlutterFire publishes the proposed API in a released
package. [Issue #18479][flutterfire-issue] and
[PR #18482][flutterfire-pr] were both still open when last checked on
2026-08-05. The PR is not merged and carries only bot review activity, and
`firebase_messaging` has published since without it (16.5.0, 2026-08-03).

The current Firebase Cloud Messaging API in the released `firebase_messaging`
package does not expose Firebase's FID-based `register`, `unregister`,
`onRegistered`, or `onUnregistered` operations. Eigen uses FIDs as the
installation identity sent to its server, so token-only FlutterFire APIs are
not an adequate replacement.

PR #18482 proposes those operations across the Dart platform interface,
Android, iOS, and web, with unit and integration coverage. A merged PR is not
enough to remove our workaround: the public API must be present in a released
`firebase_messaging` version that the package can consume.

#### Current compatibility seam

Keep the workaround narrow and internal:

- [`FirebaseMessagingRegistration`][registration-adapter] is the removable
  interface used by the notification service.
- [The native implementation][native-registration] enables messaging auto-init
  and reads the current FID through `firebase_app_installations`.
- [The web implementation][web-registration] calls the official Firebase
  Messaging JavaScript `register`, `onRegistered`, and `onUnregistered` APIs
  through Dart JS interop.
- [The Android library manifest][android-manifest] enables FID registration,
  while [the plugin Gradle build][android-gradle] temporarily supplies Firebase
  BoM 34.16.0 and `firebase-messaging`.

Do not spread direct JS interop or native SDK handling into application
features. Keeping it behind this interface makes the workaround replaceable
without changing the notification service or game implementor API.

#### Unblock and remove

1. Confirm the FlutterFire PR is merged and identify the first published
   `firebase_messaging` version containing the API.
2. Upgrade the compatible FlutterFire package set together.
3. Replace `FirebaseMessagingRegistration` usage with
   `FirebaseMessaging.instance.register`, `onRegistered`, and
   `onUnregistered`, and use `unregister` where Eigen explicitly opts an
   installation out.
4. Remove the adapter and its platform implementations.
5. Remove the Android manifest metadata, Firebase BoM pin, direct
   `firebase-messaging` dependency, and `firebase_app_installations` dependency
   only where the released FlutterFire implementation makes each one
   unnecessary. Verify this from its release and native dependency metadata;
   do not assume that the Dart API alone replaces build-time configuration.
6. Test Android and web registration, registration and unregistration events,
   guest-to-account upgrades, sign-out and account deletion, foreground and
   background delivery, and server-side installation reconciliation.
7. Generate and build a fresh game scaffold to confirm that implementors do not
   inherit new manual Firebase or Android configuration.

<!-- eigen-server -->

[npm-trusted]: https://docs.npmjs.com/trusted-publishers/
[npm-bypass-restrict]: https://github.blog/changelog/2026-07-31-restricting-npm-bypass-2fa-granular-access-tokens/
[npm-classic-revoked]: https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/
[npm-cli-8976]: https://github.com/npm/cli/issues/8976
[ca-515]: https://github.com/changesets/action/issues/515
[pnpm-11513]: https://github.com/pnpm/pnpm/issues/11513
[pub-dev-8507]: https://github.com/dart-lang/pub-dev/issues/8507
[cs-publish-yml]: https://github.com/changesets/changesets/blob/main/.github/workflows/publish.yml

<!-- eigen-flutter. Absolute URLs rather than relative paths, because this file
     no longer lives in the repository holding the code it points at. -->

[flutter-app-kotlin]: https://docs.flutter.dev/release/breaking-changes/migrate-to-built-in-kotlin/for-app-developers
[flutter-plugin-kotlin]: https://docs.flutter.dev/release/breaking-changes/migrate-to-built-in-kotlin/for-plugin-authors
[in-app-review]: https://pub.dev/packages/in_app_review
[flutterfire-issue]: https://github.com/firebase/flutterfire/issues/18479
[flutterfire-pr]: https://github.com/firebase/flutterfire/pull/18482
[registration-adapter]: https://github.com/eigeninteractive/eigen-flutter/blob/main/lib/core/notifications/firebase_messaging_registration.dart
[native-registration]: https://github.com/eigeninteractive/eigen-flutter/blob/main/lib/core/notifications/firebase_messaging_registration_native.dart
[web-registration]: https://github.com/eigeninteractive/eigen-flutter/blob/main/lib/core/notifications/firebase_messaging_registration_web.dart
[android-manifest]: https://github.com/eigeninteractive/eigen-flutter/blob/main/android/src/main/AndroidManifest.xml
[android-gradle]: https://github.com/eigeninteractive/eigen-flutter/blob/main/android/build.gradle.kts
