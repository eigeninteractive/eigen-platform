# Web assets

`sqlite3.wasm` and `drift_worker.js` are drift's web runtime, taken verbatim
from the [drift 2.35.0
release](https://github.com/simolus3/drift/releases/tag/drift-2.35.0). They are
served from the app's own origin because that is where `LocalDatabase` looks for
them, and they are what gives a browser the storage offline play needs.

Replace both together whenever the `drift` constraint in `eigen_flutter`'s
pubspec moves, and take them from the matching release: the worker and the
module are one pair.
