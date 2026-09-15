# Changelog
All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-09-15
### Added
- `PlayPurchaseGateway`, Google Play Billing behind the `eigen_flutter` `PurchaseGateway` port: localized products, consumables for repeatable offers, restoration, the account binding Play carries as `obfuscatedAccountId`, and acknowledgement that works from durable outbox evidence after a restart. It depends on `in_app_purchase_android` rather than the `in_app_purchase` umbrella, which would also link StoreKit into every iOS build.
- `UrlLauncherCheckout`, the `CheckoutLauncher` hosted storefronts open their provider's page with.
- A store screen under settings: offers and prices, the entitlements and allowances the account holds, and restore. A refusal a purchase could lift now carries the way to lift it, and one it could not does not.
- `AppStartup` offers the launch URL and every resume to the hosted storefronts, which is how a web checkout return -- a cold start carrying a purchase -- is noticed at all.
- A "Manage subscription" action, which opens the provider's own portal for a hosted subscription and Play's subscription centre for a Play one. It appears only for an account actually holding a subscription this build's storefronts sold.

### Changed
- Preserve one game-creation identity across ambiguous transport retries, so a retry cannot create or commercially count a second game.

## [0.2.0] - 2026-09-13
### Added
- Offline play in the product: the solo picker's untimed mode starts a game on the device, home and history list on-device games alongside server ones, and replay reads a finished local game from its own record.

### Changed
- The game screen issues moves through a command port, so a game played on the device and one played on the server take the same path.
- Account deletion removes this device's local games; signing out keeps them, because they are games rather than a cache of something the server holds.
- Require `eigen_client` 0.2.0, the release that carries the local-play API this package calls.
- Require `eigen_flutter` 0.10.0, whose offline-play surface this package builds on.

### Fixed
- A game whose local record diverged now reads from the server copy and refuses commands, rather than accepting moves the server will never take.

## [0.1.1] - 2026-09-11
- Adopt `go_router` 18 and `shimmer` 4 for the Flutter 3.44 baseline.

## [0.1.0] - 2026-08-21
- Extract the complete first-party application from `eigen_flutter`, leaving
the lower package reusable beneath an application-owned root.
- Own account orchestration, profiles, friends, ratings, product persistence,
app startup, navigation, and all first-party screens and platform plugins.

[0.3.0]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_shell-v0.2.0...eigen_shell-v0.3.0
[0.2.0]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_shell-v0.1.1...eigen_shell-v0.2.0
[0.1.1]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_shell-v0.1.0...eigen_shell-v0.1.1
[0.1.0]: https://github.com/eigeninteractive/eigen-platform/tree/eigen_shell-v0.1.0
