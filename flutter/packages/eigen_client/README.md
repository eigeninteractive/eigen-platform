# eigen_client

The pure Dart runtime for EigenInteractive clients. It owns the protocol-facing
domain model, server clock, authenticated HTTP error mapping, and the live game
socket. It has no dependency on Flutter, Riverpod, Firebase, navigation,
analytics, storage, or widgets.

Game implementors normally depend on
[`eigen_flutter`](https://pub.dev/packages/eigen_flutter), which composes this
package with Flutter presentation adapters. Depend on `eigen_client` directly
for a non-Flutter client or for pure Dart tests and tooling.
