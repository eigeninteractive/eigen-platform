# Changelog
All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- Offline play in the product: the solo picker's untimed mode starts a game on the device, home and history list on-device games alongside server ones, and replay reads a finished local game from its own record.

### Changed
- The game screen issues moves through a command port, so a game played on the device and one played on the server take the same path.
- Account deletion removes this device's local games; signing out keeps them, because they are games rather than a cache of something the server holds.

### Fixed
- A game whose local record diverged now reads from the server copy and refuses commands, rather than accepting moves the server will never take.

## [0.1.1] - 2026-09-11
- Adopt `go_router` 18 and `shimmer` 4 for the Flutter 3.44 baseline.

## [0.1.0] - 2026-08-21
- Extract the complete first-party application from `eigen_flutter`, leaving
the lower package reusable beneath an application-owned root.
- Own account orchestration, profiles, friends, ratings, product persistence,
app startup, navigation, and all first-party screens and platform plugins.

[Unreleased]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_shell-v0.1.1...HEAD
[0.1.1]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_shell-v0.1.0...eigen_shell-v0.1.1
[0.1.0]: https://github.com/eigeninteractive/eigen-platform/tree/eigen_shell-v0.1.0
