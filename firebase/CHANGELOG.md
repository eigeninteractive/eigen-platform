# Changelog

## Unreleased

- **Breaking.** Replace `runFirebaseEngineApp` with
  `initializeEigenFirebase`, which initializes Firebase and returns provider
  overrides. Applications compose those overrides through `eigen_shell` or
  their own `EigenFlutterScope`; the Firebase adapter no longer owns or depends
  on the first-party application shell.
- Resolve foreground-notification suppression through the provider-neutral
  active-game resolver supplied by the application layer.

## 0.1.0

- Initial optional Firebase adapter package.
- Firebase Auth, bearer tokens, Analytics, Crashlytics, Cloud Messaging, and
  Android notification resources compose above `eigen_flutter` ports.
