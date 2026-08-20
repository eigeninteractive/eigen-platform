# Dart packages

This directory contains independently publishable pure Dart packages:

- `eigen_client` is the protocol, domain, HTTP repository, clock, and
  live-session core exposed through one configured `EigenClient`.
- `eigen_codegen` is the development-only game contract generator.

Neither package depends on Flutter. Flutter presentation and the current app
shell live in [`../flutter`](../flutter/).
