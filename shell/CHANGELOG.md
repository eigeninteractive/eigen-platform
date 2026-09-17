# Changelog
All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- The home screen offers to have the browser keep games played on this device, explaining what it is for before the browser asks, and only while such a game has yet to upload.
- A banner offering a reload when the replica stops answering, which in a browser is how a database whose worker has been taken away appears.

### Changed
- The app refreshes when it comes back into view (`AppLifecycleListener.onShow`) rather than whenever it regains focus, which on the web was every alt-tab and the closing of the sign-in popup; the open game reconnects on the same signal.
- On the web, the update-required action lets the newly deployed service worker take over before reloading, so the reload lands on the new build.

### Fixed
- Dismissing Google's sign-in no longer shows an error, and dismissing it while switching to an existing account keeps the guest and its data. A blocked sign-in window says to allow pop-ups.

## [0.5.0] - 2026-09-16
### Added
- Every screen opens from the device replica: the home and history lists, replays, the profile, ratings and friends render with no network and no spinner on a device that has synced before, and pull-to-refresh runs the sync pass.
- History pages older games in as the list is scrolled, from the server when the device does not hold them yet, and the home screen says how long ago the account last synced.

### Changed
- The home and history lists no longer merge games played on this device into the server's list by hand; both kinds are rows in one table and sort together.
- A server game opened offline shows the board as it was last seen and holds its controls still, instead of failing to open. A game played on this device shows no offline or reconnecting banner at all.

## [0.4.0] - 2026-09-16
### Added
- The pickers that seat a server bot mark an opponent the account's access does not include, and a refusal to seat one offers the store. The untimed picker never does: a game played on the device is not priced.

### Fixed
- The store action on a refusal no longer needs the screen that showed it to still be open.

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

[Unreleased]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_shell-v0.5.0...HEAD
[0.5.0]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_shell-v0.4.0...eigen_shell-v0.5.0
[0.4.0]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_shell-v0.3.0...eigen_shell-v0.4.0
[0.3.0]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_shell-v0.2.0...eigen_shell-v0.3.0
[0.2.0]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_shell-v0.1.1...eigen_shell-v0.2.0
[0.1.1]: https://github.com/eigeninteractive/eigen-platform/compare/eigen_shell-v0.1.0...eigen_shell-v0.1.1
[0.1.0]: https://github.com/eigeninteractive/eigen-platform/tree/eigen_shell-v0.1.0
