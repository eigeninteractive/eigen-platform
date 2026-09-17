---
"create-eigen-game": minor
---

A scaffolded game's web app opens offline from its first visit, and updates cleanly (decision 0014).

- `build:web` finishes by generating the service worker with Workbox (`workbox generateSW workbox-config.cjs`), which precaches the whole build. `workbox-cli` is a root dev dependency, and the generated CI installs the root and runs `build:web`. The hand-written `web/eigen_offline_sw.js` is gone.
- `web/flutter_bootstrap.js` starts Flutter without waiting for either service worker, and keeps the CDN files a first visit loads for offline use.
- `web/sqlite3.wasm` and `web/drift_worker.js` are gone: `eigen_flutter` ships drift's web runtime itself.
- The messaging worker loads the Firebase JS SDK version `firebase_core_web` is tested against, 12.19.0.

Migrating an existing game: delete `app/web/sqlite3.wasm`, `app/web/drift_worker.js`, and `app/web/eigen_offline_sw.js`; copy `workbox-config.cjs`, `app/web/flutter_bootstrap.js`, and the `build:web` script from a fresh scaffold; add `workbox-cli` to the root's dev dependencies; and add every route in the Worker's `run_worker_first` that it renders itself to `navigateFallbackDenylist`.
