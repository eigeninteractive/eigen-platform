# Drift's web runtime

`sqlite3.wasm` and `drift_worker.js` are what give a browser the replica
database: the SQLite module, and the worker that hosts it so every tab of the
app shares one database. They are taken verbatim from the [drift 2.35.0
release](https://github.com/simolus3/drift/releases/tag/drift-2.35.0), and the
worker and the module are one pair.

They ship here, as web-only package assets, because this package is what
chooses drift. An app gets them at
`assets/packages/eigen_flutter/assets/drift/` without copying anything, and
`pubspec.yaml`'s floor for `drift` names the release they come from. Drift
supports a newer client with an older worker within a major version, so an app
may resolve a later 2.x, but raising the floor means replacing both files from
the matching release in the same change: fixes to web storage live in the
worker, not in the Dart package.
