# P0

- **Web as a first-class target** — `web_socket_channel` over `wss` with the
  `?token=` upgrade, web Firebase auth, `cached_network_image` against the
  worker-served avatar URL, and the FCM service worker + VAPID key. Add web to
  the CI matrix.
- **Generate the Dart payload types from the game's Standard Schema.** A game
  declares `state` / `action` / `config` once in TypeScript, then hand-writes the
  Dart mirror — and every implementor installs `freezed`, `json_serializable` and
  `build_runner` to do it. Builders are not inheritable from a dependency (only
  annotations are), so the engine cannot supply that toolchain. But the schemas
  are machine-readable: emitting them as JSON Schema alongside `openapi.json`
  would let a generator produce the Dart payload types, turning the twin from a
  transcription that can drift into a build artifact that cannot. This is the
  single largest remaining source of twin bugs, and the `field_rename` /
  wire-key mismatch class disappears with it.
- **Scaffolding: `create-eigen-game`.** Starting a game today means creating two
  repos by hand and getting a dozen small things right — the Worker glue,
  `wrangler.jsonc` bindings, the v1 rules unit, the Dart `GameModule`, the
  matching `build.yaml` (whose `field_rename` must agree with the schemas), the
  fixture directories in *both* repos, and the two CI workflows. One generator
  that writes both halves at a known-good starting point removes all of it.
- **Decide the monorepo question.** Four repos today (`eigen-server`,
  `eigen-flutter`, `eigen-web`, plus each game) with three hand-maintained
  cross-repo couplings: `openapi.json`, the TypeScript sources the docs
  reference, and the twin fixtures — the last of which **nothing** syncs and no
  CI can see. A monorepo makes all three a single atomic change and lets a
  `diff -r` guard the fixtures; the costs are a mixed pnpm/Dart toolchain in one
  place, and losing the clean per-repo open-source boundary. Worth deciding
  before there are several games, not after. Relates to the two items above:
  schema-derived types and scaffolding both get simpler in a monorepo.
- **Finish the docs product.** Shipped: the task-first IA (each page carries both
  the TypeScript and Dart halves of one task), the generated HTTP + TypeScript
  references (`pnpm sync-api`), local search, `llms.txt` / `llms-full.txt` /
  per-page `.md`, the showcase page, the `eigen` Claude Code plugin, and the RPS
  client half in `eigen-flutter/example/`. Remaining: publish to pub.dev and turn
  `reference/dart.md` into a real link-out; add real games to `src/data/games.ts`
  as they ship; add screenshots/logos to the showcase.
- changelog maintenance for both, release instructions, etc. (the changelog is
  now `eigen-web`'s `/blog`).
- **Pick a house convention for game payload wire keys.** RPS's TypeScript
  schemas use camelCase; `strategy` used snake_case with `field_rename: snake`.
  Game payloads are game-owned so neither is wrong, but the two halves' codecs
  must agree, and choosing now is cheaper than migrating games later.

# P1

- [ ] Monetization Flows
- [ ] Persisting game history, games, ratings, etc. using Drift
- [ ] Offline App Support with Bot Play
- [ ] Flag a game or player
- [ ] Spectating Support
- [ ] Quick Match
- [ ] Target web platform, Web App notifications
