# Changelog
## [Unreleased]
### Changed
- A sync request is answered by a completed pass that began pulling after it was made, instead of joining a pass in flight: passes never overlap, a burst of triggers costs one pass, a request made mid-pull still gets its own, and a failed pass answers nothing. `SyncPass` takes a `SyncLock` so processes sharing a replica, such as browser tabs, share passes too, and `run` answers null when an earlier pass already covered the request.
- `AccountReplica.applySync` takes `pulledAt`, and `lastSyncedAt` is the moment the last completed pass began pulling, written only by the page that completes it. `AccountReplica.lastSyncedAt()` reads it.

## [0.5.0] - 2026-09-16
### Added
- A replica of the server's read model on the device, in Drift. `AccountReplica` and `PublicReplica` answer every list, profile, rating, friend and replay as a live query; `SyncPass` fills them from one `GET /me/sync` and uploads the games this device decided; `replicatedSessions` opens a game from the replica and writes each session it applies back.
- `AccountRepository` for the caller's own account: the sync read, a page of history older than the device holds, the profile, and its mutations.

### Changed
- `GameSummary` carries `seq`, the game's revision in its Durable Object, so a write is applied only when it is not older than what a client already holds.
- A local game is rows in the same tables as any other game. `LocalGameStorage` replaces the `LocalGameStore` port, and a commit appends one transition and one frame instead of rewriting the whole log as a document.

### Removed
- `ProfileRepository`, `GameRepository.getMyGames`, `RatingRepository.getMyRatings`, `RatingRepository.getMyRatingHistory`, `SocialRepository.getFriends` and `getFriendRequests`: what they fetched arrives in the sync read and is read from the replica.

## [0.4.0] - 2026-09-16
### Changed
- `Bot.tier` is required: every bot belongs to exactly one commercial tier, `standard` unless the deployment prices it differently, so constructing a `Bot` now needs one.

## [0.3.0] - 2026-09-15
### Added
- `CommerceRepository` and the generated access and catalog types for verified claims, restoration, hosted checkout, and subscription management.

### Changed
- Game creation requires a stable `creationId`; `newGameCreationId()` mints one so a retried creation resolves to the original game, and `newCheckoutOperationId()` does the same for hosted checkout.
- `CommerceRepository.getCatalog` takes the storefronts this build can buy through, so the Worker consults only those providers' pricing APIs.

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

[Unreleased]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_client-v0.5.0...HEAD
[0.5.0]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_client-v0.4.0...eigen_client-v0.5.0
[0.4.0]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_client-v0.3.0...eigen_client-v0.4.0
[0.3.0]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_client-v0.2.0...eigen_client-v0.3.0
[0.2.0]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_client-v0.1.1...eigen_client-v0.2.0
[0.1.1]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_client-v0.1.0...eigen_client-v0.1.1
[0.1.0]: https://github.com/eigeninteractive/eigen-platform/tree/eigen_client-v0.1.0
