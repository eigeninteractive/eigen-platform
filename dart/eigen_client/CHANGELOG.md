# Changelog
## [Unreleased]
### Added
- `CommerceRepository` and the generated access and catalog types for verified claims, restoration, hosted checkout, and subscription management.

### Changed
- Game creation requires a stable `creationId`; `newGameCreationId()` mints one so a retried creation resolves to the original game, and `newCheckoutOperationId()` does the same for hosted checkout.

## [0.2.0] - 2026-09-13
### Added
- The local half of offline play: EigenRng, a port of the engine commit kernel for an untimed game, LocalGameRules, the record and its store port, the bot-runner port, and LocalGameEngine.
- LocalGameSync, which carries a device local games to the server by replaying their logs, and localRecordFromRemote, which rebuilds a record from the server copy.
- GameRepository methods for the three local-game routes, and getWholeLocalRecord, which follows the record route pages so a resumed game is never rebuilt from a truncated log.
- jsonEquals, value equality for two codecs of one JSON schema, where an absent key and a written null are the same value.

## [0.1.1] - 2026-09-11
- Require every replacement game session to have a higher authoritative
sequence while continuing to prevent a terminal game from being resurrected
by a later active snapshot.

## [0.1.0] - 2026-08-21
- Initial pure Dart client and domain package.

[Unreleased]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_client-v0.2.0...HEAD
[0.2.0]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_client-v0.1.1...eigen_client-v0.2.0
[0.1.1]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_client-v0.1.0...eigen_client-v0.1.1
[0.1.0]: https://github.com/eigeninteractive/eigen-platform/tree/eigen_client-v0.1.0
