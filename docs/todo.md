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
- **Turn on `enumUnknownDefaultCase` for the Dart client.** Generated enums parse
  strictly today — no fallback member — so a client that meets a wire value it
  has never heard of *throws while decoding the response*. That makes adding a
  member to `GameStatus` / `ErrorCode` / `GameAccess` / seat type a **major**
  bump even though it is purely additive, and because an installed app cannot be
  force-updated, every such change breaks apps already in the field until they
  update. It is the sharpest edge in the release model: unknown *fields* are
  already tolerated (`disallowUnrecognizedKeys: false`), so enums are the last
  gap.
  **Verified working on the pinned generator (7.17.0)** — add
  `enumUnknownDefaultCase=true` to the `--additional-properties` in
  `scripts/generate-dart-client.sh`, and every enum gains
  `unknownDefaultOpenApi` plus a matching `unknownEnumValue:` in `@JsonKey`,
  which reaches the real `$enumDecode` call. (The bug that made this a no-op
  under `json_serializable`, OpenAPITools/openapi-generator#18370, was fixed in
  7.9.0 by #19416; the still-open #21411 only affects `useEnumExtension`, which
  this repo does not set.)
  Two consequences to plan for: it is itself a **one-time breaking change** to
  `eigen_api`'s Dart surface, because every exhaustive `switch` in eigen-flutter
  gains a case — so land it with a coordinated client release; and the fallback
  is **read-side only**, since it serialises back to the literal
  `unknown_default_open_api`, which no route accepts. Update the "what a major
  bump means" section of `eigen-web/docs/reference/compatibility.md` when it
  lands.
- **Scaffolding: `create-eigen-game`.** Starting a game today means creating two
  repos by hand and getting a dozen small things right — the Worker glue,
  `wrangler.jsonc` bindings, the v1 rules unit, the Dart `GameModule`, the
  matching `build.yaml` (whose `field_rename` must agree with the schemas), the
  fixture directories in *both* repos, and the two CI workflows. One generator
  that writes both halves at a known-good starting point removes all of it.
- **Finish the docs product.** Shipped: the task-first IA (each page carries both
  the TypeScript and Dart halves of one task), the generated HTTP + TypeScript
  references (`pnpm sync-api`), local search, `llms.txt` / `llms-full.txt` /
  per-page `.md`, the showcase page, the `eigen` Claude Code plugin, and the RPS
  client half in `eigen-flutter/example/`. Remaining: publish to pub.dev and turn
  `reference/dart.md` into a real link-out; add real games to `src/data/games.ts`
  as they ship; add screenshots/logos to the showcase.

# P1

- [ ] Monetization Flows
- [ ] Persisting game history, games, ratings, etc. using Drift
- [ ] Offline App Support with Bot Play
- [ ] Flag a game or player
- [ ] Spectating Support
- [ ] Quick Match
- [ ] Target web platform, Web App notifications
