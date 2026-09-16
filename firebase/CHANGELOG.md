# Changelog
## [Unreleased]
### Added
- `foregroundMessages`, the stream that lets the app sync when a push arrives while it is open.

## [0.3.2] - 2026-09-16
### Changed
- Require the release of its sibling packages in this version.

## [0.3.1] - 2026-09-15
### Changed
- Require the release of its sibling packages in this version.

## [0.3.0] - 2026-09-13
### Changed
- Require `eigen_flutter` 0.10.0. The 0.2.0 release as published pins the 0.9.x line, which no longer resolves beside it.

## [0.2.0] - 2026-09-09
- **Breaking.** Replace `runFirebaseEngineApp` with
`initializeEigenFirebase`, which initializes Firebase and returns provider
overrides. Applications compose those overrides through `eigen_shell` or
their own `EigenFlutterScope`; the Firebase adapter no longer owns or depends
on the first-party application shell.
- Resolve foreground-notification suppression through the provider-neutral
active-game resolver supplied by the application layer.
- Follow Firebase Messaging's native distinction between retryable and
permanent Android notification-permission denials.

## [0.1.0] - 2026-08-21
- Initial optional Firebase adapter package.
- Firebase Auth, bearer tokens, Analytics, Crashlytics, Cloud Messaging, and
Android notification resources compose above `eigen_flutter` ports.

[Unreleased]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_firebase-v0.3.2...HEAD
[0.3.2]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_firebase-v0.3.1...eigen_firebase-v0.3.2
[0.3.1]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_firebase-v0.3.0...eigen_firebase-v0.3.1
[0.3.0]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_firebase-v0.2.0...eigen_firebase-v0.3.0
[0.2.0]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_firebase-v0.1.0...eigen_firebase-v0.2.0
[0.1.0]: https://github.com/eigeninteractive/eigen-platform/tree/eigen_firebase-v0.1.0
