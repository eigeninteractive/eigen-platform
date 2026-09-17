# Drift's web runtime

`sqlite3.wasm` and `drift_worker.js` are what give a browser the replica
database: the SQLite module, and the worker that hosts it so every tab of the
app shares one database. They are taken verbatim from the [drift 2.35.0
release](https://github.com/simolus3/drift/releases/tag/drift-2.35.0), and the
worker and the module are one pair.

They ship here, as web-only package assets, because this package is what
chooses drift. An app gets them at
`assets/packages/eigen_flutter/assets/drift/` without copying anything, and
`pubspec.yaml` holds `drift` to the 2.35 line, so no app can resolve a drift
minor release the worker was not built with. (Exact would be tighter, but pub
does not publish a single-version constraint.) Moving that constraint means
replacing both files from the matching release in the same change.
