# Manually Tracked


- Why do we need engineCall and separate api definitions in engine_api_providers
  instead of eigenApi? Cant we just add the middleware to eigenApi instead? Is
  this the idiomatic way to handle errors?
- Web - wss + ?token=, web Firebase auth, avatar URLs; add to CI
- Docs

- CI Setup (Biome, etc.)
- Twin Fixtures Types Issue
- Compare to old structure end to end
- Are we reinventing CAS?
- Do we need GameStub?
- Make single attemps retry based (where all does it make sense)
- Can anything be optimizied - unnecessary network call, N + 1 patterns, batch simplifications, etc.?
- How and what to remove in eigen interactive web repo?

# P1

- [ ] Monetization Flows
- [ ] Persisting game history, games, ratings, etc. using Drift
- [ ] Offline App Support with Bot Play
- [ ] Flag a game or player
- [ ] Spectating Support
- [ ] Quick Match
- [ ] Target web platform, Web App notifications


# Claude Maintained

The **single** forward-looking tracker for the Eigen engine, covering both the
server (`eigen-server`) and the client (`eigen-flutter` + game apps like
`strategy`). It replaces the migration-era `handoff.md`, `engine_stack.md`,
`client_migration.md`, and `client_changes.md`, which were plans and progress
trackers for work that has now landed; their decision history lives in git.

For how anything *works*, read the reference docs — they are the source of truth
and are kept current:

| Doc | What it is |
|---|---|
| [`architecture.md`](./architecture.md) | How the server works, end to end. Start here. |
| [`building_a_game.md`](./building_a_game.md) | How to build a game on the engine (the TypeScript rules contract). |
| `docs/client_reference.md` in **`eigen-flutter`** | The client: transport, the Dart rules contract, the app shell, and shipping an app. |

## Status

- **The server is complete.** All engine functionality is built, tested and
  documented. 160+ tests across four packages.
- **The client migration has landed.** `eigen-flutter` and `strategy` both
  compile and pass their tests against the generated client; Supabase is gone
  from the Dart code, from every pubspec, and now from both repos entirely.
- **`strategy` has no server half yet** (§2) — the reference *app* exists, the
  reference *game Worker* does not. `examples/rps` is the only deployable game.
- **Nothing has ever run against a deployed Worker.** Every test to date is
  against local simulation or stubs. That is the biggest single unknown below.

---

## 1. The critical path — cutover

Ordered. Nothing here is Dart work except where noted.

1. **Platform configuration** (interactive, yours to run):
   - `flutterfire configure` for each app that needs regenerating.
   - Android intent-filters + iOS associated-domains for `/j/*`, matching the
     host the server serves `assetlinks.json` / `apple-app-site-association`
     from. The Android entry needs the **release** signing cert's SHA-256, and
     the iOS entitlement must also be wired in Xcode's Associated Domains —
     the entitlements file alone is not enough.
   - Add the Play App Signing SHA-1/SHA-256 to Firebase **after the first Play
     upload**, or Google Sign-In works in dev and fails in production.
   - See `client_reference.md` §20–21 for the full sequence.
2. **Apple Sign-In is unwired.** It was scoped for Mobile + Web but no
   `sign_in_with_apple` dependency exists; only Google and Anonymous are
   implemented. This is easy to miss because everything compiles without it.
   Web is its own flow.
3. **End-to-end verification against a deployed Worker.** Exercise at minimum:
   sign-in, create + join, a live two-client game (frames, reconnect, the `sync`
   reconciliation), create-solo with a seated bot, avatar upload, push delivery,
   deep-link open, account deletion.
4. **Fix strategy's CI before relying on it** — see §2, it is currently broken.
   Also note strategy has **no Worker and no TypeScript rules** (§2), so it has
   no backend to be verified against yet; `examples/rps` is the only deployable
   game today.
5. **Web as a first-class target** — `web_socket_channel` over `wss` with the
   `?token=` upgrade, web Firebase auth, `cached_network_image` against the
   worker-served avatar URL, and the FCM service worker + VAPID key. Add web to
   the CI matrix.
6. **Cutover is big-bang** — no dual-running and no data migration (there are no
   production users): apply the D1 migrations, deploy the Worker, ship the
   client. This is the first point that needs a real R2 bucket and a payment
   method (§5).

---

## 2. Known broken / dead code

Verified by inspection, not inferred. These are the concrete leftovers of the
migration.

### Broken

- **`strategy/.github/workflows/android.yml` cannot succeed.** Both the `test`
  and `build` jobs write `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` into `.env`,
  but `lib/env/env.dart` now requires a non-optional **`API_BASE_URL`** — envied
  code generation fails. Replace those two lines with `API_BASE_URL`, add the
  matching repo secret, and delete the two Supabase secrets. (The dead `deno
  test` step is already gone.)
- **`eigen-flutter` fails its own format gate.** `flutter.yml` runs `dart format
  --output=none --set-exit-if-changed .`, and **19 non-generated files** under
  `lib/` and `test/` are not formatter-clean (line-splitting in
  `server_clock.dart`, `game_repository.dart`, the game screens, and others).
  Pre-existing, unrelated to the Supabase removal. Fix is `dart format .` — but
  give it its own commit, because it is 19 files of pure whitespace churn.

### Strategy has no server half

`strategy` is the reference app, and **its game has no authoritative
implementation**. The Supabase-era TypeScript rules unit was deleted with the
rest of `supabase/`; recover it from git (`strategy@0062947:
supabase/functions/_lib/game/v1.ts`) if useful as a starting point, but it
targets the old Deno contract, not `@eigen/rules`.

What exists: the Dart twin (`lib/game/v1/rules.dart`) and the shared twin
fixtures, relocated to `strategy/test/fixtures/game/v1/` and still passing. Those
fixtures are the behavioural spec the TypeScript units must satisfy. What does
not exist: the Worker, the TS rules, and therefore any backend for the app to
talk to.

### Documentation accuracy

- `architecture.md` §11.1 says the operator "is handed `deriveBotKey(bot_id)`",
  but `deriveBotKey` is module-private in `packages/server/src/bot/bot-auth.ts`
  and is not exported. Either export it as a small operator utility, or reword to
  describe computing the HMAC by hand.

### Done (2026-07-22)

Kept here briefly so the next reader doesn't go looking for them:

- **`eigen-server` CI added** — `.github/workflows/ci.yml`: Biome, build,
  typecheck, test, and an `openapi.json` drift guard. Checks only; it holds no
  Cloudflare credentials and never deploys, because `pnpm deploy` applies D1
  migrations against a real database. Root `packageManager` field added (the
  pnpm action reads it; it does not read `devEngines`).
- **Supabase deleted everywhere** — both `supabase/` directories,
  `eigen-flutter/bin/{sync_supabase.dart,generate_db_types.sh,setup_local.sh}`,
  `.github/workflows/supabase.yml`, the deno `.vscode/` settings and extension
  recommendations in both Flutter repos, the `supabase` MCP server entries, and
  the deno step in strategy's Android workflow.
- **Twin fixtures rehomed** to `test/fixtures/game/v<N>/` in both Flutter repos,
  keeping both twin-drift tests alive rather than deleting them with `supabase/`.
- **Dead timing constants removed** — `kExpiryTriggerDelay`,
  `kExpiryTriggerEpsilon`, `kServerDeadlineGrace` and their test. The DO alarm is
  the timer; the client never nudges on expiry. `kSoftDeadlineMargin`,
  `kSoftDeadlineMaxFraction` and `softDeadlineMarginFor` are live and stay.
- **Stale docstrings fixed** — the six client files that still described
  `engine_commit_action`, `app_join_game`, `create_game`, pg_cron and Realtime,
  plus the `§2.4`/`§6`/`§5.2` anchors in `examples/rps/wrangler.jsonc`.
- **READMEs** — `eigen-server/README.md` written (it had none);
  `eigen-flutter` and `strategy` READMEs given real new-machine setup sections.
  `examples/rps/.dev.vars.example` added so a fresh clone can run `wrangler dev`.

---

## 3. Open questions

Carried over from working notes; none is blocking, all are worth an answer
before the codebase sets.

- **Is `engineCall` + the hand-assembled per-resource providers the idiomatic
  shape?** Could the error mapping be a Dio interceptor on a single `eigenApi`
  instance instead, so call sites don't wrap every request? The current split
  exists because a failure *with* a response and a failure *with none* must stay
  distinguishable to a state-changing command — but that distinction could live
  in an interceptor too.
- **Twin-fixture types.** The fixture runner's typing is looser than the rest of
  the contract; tighten it so a malformed fixture fails at load, not at compare.
- **End-to-end comparison against the old structure.** A deliberate pass over
  the Supabase-era feature list to confirm nothing was quietly dropped rather
  than intentionally cut. (The doc-parity pass covered the *documented* surface;
  this is about behaviour.)
- **Are we reinventing CAS?** The revision-guarded rating write is hand-rolled
  compare-and-swap in D1. Worth checking whether the same guarantee falls out of
  a simpler formulation before it grows.
- **Do we need `GameStub`?** Question the indirection.
- **Where should single-attempt become retrying?** V1 is deliberately "single
  attempt + error log" everywhere. Now that the shape is settled, decide case by
  case where a bounded retry actually buys correctness (bot wake? the D1
  finish-apply? FCM?) versus where existing idempotency already covers it.
- **Optimization sweep.** Look for unnecessary round trips, N+1 patterns, and
  batchable D1 work — particularly around lobby/history reads and the batch
  `players?ids=` path.
- **The `eigeninteractive` web repo.** The Cloudflare Worker that used to own the
  per-game subdomain map and serve the deep-link verification files is now
  redundant: the game Worker generates `.well-known` itself and serves `/j/`.
  Decide what to remove there, and how the apex domain and legal pages are hosted
  going forward (`LEGAL_HOST` deliberately points at a domain with **no**
  deep-link config, so it must not become the game host).

---

## 4. Deferred features (no paid tier required)

Each is held open by a shipped seam — engine work, but no infrastructure change.

- **D1 FTS5 user search.** `GET /users/search` is a `LIKE` substring match
  today. Swap in an FTS5 virtual table + triggers when volume warrants; the route
  and its response shape don't change.
- **Offline-solo transcript import.** The replacement for the deleted
  client-side local bots: the client simulates a whole solo game on-device (Dart
  rules twin + a Dart bot brain, seeded RNG), then uploads the seed + ordered
  action transcript; the server replays it through the real TS rules and records
  it as a normal finished game. The `local` bot type and the import seam exist;
  the endpoint and the client loop do not. This is the deferred feature the
  timing rules were deliberately shaped around — the "bots ⇒ timed" gate is
  scoped to *server* seating precisely so an offline solo game can be untimed.
- **Social depth.** The friend graph, search, blocking and friends' games are
  built; a notifications/inbox surface and richer presence are not scoped.

---

## 5. Paid-tier items

Deferred until a real deploy asks for them. All are held open by shipped seams.

- **A real avatars R2 bucket.** Upload/serve is built and tested under local R2
  simulation. A card enters only at `wrangler r2 bucket create` for a deploy with
  uploads enabled. Optionally set `avatars.publicBaseUrl` to serve reads straight
  from a bucket custom domain, bypassing the Worker.
- **R2 cold-tier history sweep.** Finished-game history lives in each game's DO
  forever (free runway ≈ 125k–250k games in the 5 GB account-wide DO SQLite
  quota). When that fills, an age-based sweep writes the frozen blob the finish
  compaction already leaves to a private bucket, drops the DO's storage, and
  stamps `archived_at`. Replay then reads DO-if-present-else-R2 behind the
  existing `HistoryStore` interface — the replay route never changes.
- **The free → paid plan upgrade.** Day 0 runs entirely on the Workers free plan
  with no payment method. The first ceiling is DO storage writes (~100k rows/day
  ≈ ~1,400 games/day); crossing it is a **one-click plan upgrade, zero code
  change**.

---

## 6. Product backlog

Not engine work — product direction, unscheduled.

- Implement **Bravado** (the second game, and the real test of the whitelabel
  claim — RPS is too simple to stress the contract).
- Monetization flows.
- Persisting game history / games / ratings on-device (Drift).
- Offline app support with bot play (depends on §4's transcript import).
- Flag a game or player.
- Spectating support.
- Quick match.
- Web platform + web push notifications.

---

## 7. Standing constraints

The rules of the road. Still in force; they shaped the build and should shape
what comes next.

- **jose** for Firebase verification — not a bundled Firebase SDK.
- **No retry machinery in v1** — single attempt + error log everywhere (bot
  wakes, the outbox, FCM). The architecture makes everything idempotent or
  self-healing instead. Revisit deliberately (§3), not incidentally.
- **No identity denormalization** onto game rows — the batch `players?ids=`
  endpoint plus the client's persisted cache cover it.
- **Versions are strictly serial, no gaps, ever** — the same-view rule governs
  acceptance only.
- **Wire enums are closed sets.** The Dart client generates enums with no
  `unknown` sentinel and parses strictly, so adding a member to any enum on the
  wire — `GameStatus`, `ErrorCode`, `GameAccess`, seat type — is a breaking
  change needing a schema-version bump and a coordinated client release.
- **Fix wire awkwardness at the source.** A shape the generated client consumes
  badly gets fixed in the zod schemas and regenerated, never patched around in
  Dart. Re-emit `openapi.json` and rerun `tool/generate_api.sh` in the same
  change.
- **A game app depends on `eigen_flutter` alone**, and imports only its barrel —
  never `eigen_api`, never a deep path. Enforced by
  `test/core/architecture/api_isolation_test.dart`.
- **No real R2 bucket / no payment method** until explicitly enabled for a
  deploy.
- **Docstrings are self-sufficient** — no section-number cross-references in
  code, and no references to systems that no longer exist (§2).
- **Keep the three reference docs current** when the architecture changes. They
  are the territory; this file is only the list of what is not yet built.
