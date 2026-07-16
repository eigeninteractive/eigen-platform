# Handoff — Eigen Engine → Cloudflare-native (`eigen-server`)

Context document for starting a Claude Code session in this repo. It carries
everything decided in the `eigen_engine` sessions that led here. Read this
first, then the architecture of record.

## 0. The one source of truth

**`../eigen_engine/docs/engine_stack.md`** is the architecture of record.
Every decision below is written up there in full, with rationale. When this
handoff and that doc disagree, the doc wins. Read it end-to-end before
writing engine code; it is long but it IS the spec.

The old Supabase implementation lives in `../eigen_engine` (Dart/Flutter
engine) and its TS edge functions. It is the *behavioral* reference — the
game rules contract, same-view semantics, rating math, and bot/FCM/short-code
logic all port from there — but the Supabase stack itself is frozen and will
be retired at cutover (big-bang, no dual-running).

## 1. Mission

Migrate the **Eigen Engine** — a whitelabel, server-authoritative, turn-based
multiplayer game engine (Flutter client, TypeScript game rules) — from
Supabase to Cloudflare-native:

- **Workers** (hono + @hono/zod-openapi) for the API,
- **one Durable Object per game** (SQLite storage) as the authoritative
  serialized game session — live *and finished*: the DO's SQLite **is** the
  game's permanent history,
- **D1** for cross-game data (users, summaries, ratings, relationships),
- **Firebase Auth** verified in-worker via **jose** (user explicitly rejected
  `firebase-auth-cloudflare-workers` — low downloads, unofficial),
- **R2** only as opt-in (avatar uploads, v1, developed under free local
  simulation) or later (history cold tier) — because R2 requires a payment
  method even for its free tier, and the day-0 design requires **no card**.

Two repos: this one (`eigen-server`, TS pnpm monorepo) and `eigen_engine`
(stays Dart; later splits into `eigen_client` transport + `eigen_flutter`
shell). The OpenAPI spec is generated here and vendored into the Dart side
for codegen. First example game: RPS (`examples/rps`), then Bravado.

## 2. Division of labor (standing agreement)

- **The user builds the repo skeleton themselves**, CLI-first per doc §15 —
  they want to learn the CF flow, and CLIs postdate the model's knowledge
  cutoff. **CLI/scaffold output beats doc snippets** (one known exception:
  C3 scaffolds the legacy DO `migrations` array — we use the `exports` field
  instead, already applied in `examples/rps/wrangler.jsonc`).
- **Claude takes over code once hello-world serves under `wrangler dev`**,
  starting with `@eigen/rules` + `@eigen/kernel` (twin fixtures;
  timing/grace/same-view under unit test), then the §14 build plan:
  Spike → Kernel → Runtime → Conformance → Client → Cutover.

## 3. Repo state at handoff (2026-07-16)

Done (verify with `git log` — it may have moved on):

- Root: `package.json` (pnpm 11 via `devEngines`, dev deps installed:
  wrangler 4, vitest 4 + `@cloudflare/vitest-pool-workers`, tsup, biome 2,
  changesets, typescript 5.9), `pnpm-workspace.yaml` (`packages/*` +
  `examples/*`, `allowBuilds` for esbuild/workerd/sharp), one root lockfile,
  `tsconfig.base.json`, `biome.json`, `.nvmrc` (Node 24), `AGENTS.md`
  (CF docs discipline — **follow it**: verify Workers APIs/limits against
  live docs, the docs MCP server is configured), `CLAUDE.md` → `@AGENTS.md`.
- `packages/{rules,kernel,testkit}`: manifests only, no src yet.
  `@eigen/rules` deps: `@standard-schema/spec`. `@eigen/kernel` deps:
  `openskill`, `rand-seed`. **`packages/server` does not exist yet** (4th
  package: DO + routes + D1 as folders in one package, since DO classes
  export from the same worker bundle).
- `examples/rps`: C3-scaffolded worker with `GameDO`/`GAME_DO` (rename from
  `MyDurableObject` already done), `exports: { GameDO: { type:
  "durable-object", storage: "sqlite" } }`, static assets dir, D1 binding
  `rps_dev` → database `rps-dev` (real ID — `d1 create` has been run), R2
  binding `AVATARS` → `eigeninteractive-rps-avatars-dev` (works under local
  simulation; **no real bucket created — do not create one**, that is the
  moment a card is required), cron trigger `0 3 * * *`, `nodejs_compat`,
  ES2024 tsconfig. `src/index.ts` is still the hello-world DO template.
- `examples/temp/`: untracked C3 scaffold kept for reference — delete when
  no longer needed.

Not done yet: vitest-pool-workers wiring, package src stubs,
`packages/server`, hono/zod/jose/drizzle installs, any engine code.

## 4. Locked design decisions

All dated, all final unless the user reopens them. Full write-ups in the
architecture doc (section refs given).

### Platform & cost
- **Free tier from day 0, no payment method anywhere in the required path.**
  Day-0 inventory is exactly DO SQLite + D1. Binder: DO 100k rows
  written/day ≈ 1,400 games/day. Upgrade trigger: sustained ~900 games/day
  or first cap error — one click, zero code change. (§10)
- **KV rejected twice** (once for authoritative data, once as a card-free
  history store): its design center is edge-cached hot reads — the opposite
  of write-once cold replay blobs. Don't relitigate. (Appendix)

### Game session core
- **Grace**: one constant in the kernel — accept while
  `now <= deadline + grace`; alarm armed at `deadline + grace`. DO
  serialization removed the old 3-place race symmetry. Client expiry nudge
  and `internal/*` route group are deleted. (§4)
- **Alarms are deadline-only, no multiplexer.** Bot wakes and finish outbox
  get ONE attempt + error log — **no retry machinery in v1** (user
  constraint). Timeout backstops lost bot wakes.
- **Idempotency**: `commandId` (client→DO dedupe, stored response replayed)
  and `finish_id` (DO→D1 apply dedupe). Serialization orders commands but
  can't identify duplicates.
- **Same-view rule (simultaneous moves)**: a stale-`expectedVersion` action
  is accepted iff that seat's projected observation (data + observed
  pending) is byte-identical between expectedVersion and current (compare
  stored frames, canonical JSON); else reject "board updated". Implementors
  control policy implicitly via what `computeObservation` reveals.
  **Versions stay strictly serial** — the rule governs acceptance only;
  every accepted action commits as the next version in arrival order.
  Lifecycle commands skip version checks. Testkit ships the canonical
  accept/reject scenario pair.

### History & storage (§4.5, §4.6, §5)
- **Game history is retained in the game's DO** (supersedes
  R2-write-at-finish; "archive" renamed → "game history"). The finish
  transaction **compacts** in the same atomic step: delete per-seat
  `frames[]` (live-only) and command-dedupe rows; ~20–40 KB retained/game.
  Outbox row cleared only AFTER the D1 apply succeeds (it is the recovery
  signal; failed apply → manual re-poke, idempotent via `finish_id`). DO
  storage is never dropped at finish — only at cancel/abort.
- **Replay = the live range-fetch path** against the finished DO, projected
  via `computeObservation(…, isReplay: true)` with the caller's seat
  (null = viewer), version-range paged. History *lists* read D1 summaries.
- **V1 ships the hot path only**, held open by four seams:
  1. store-agnostic replay contract (client never learns where history
     lives; range paging);
  2. the ~20-line **`HistoryStore` interface SHIPS in v1** (user's explicit
     call) with exactly ONE implementation (DO range fetch) and no dispatch
     logic;
  3. compaction leaves field-for-field the future cold blob
     `{game, roster, transitions[{version,state,action,pending,timing}],
     outcomes, ratingDeltas}` (raw, no frames);
  4. nullable **`archived_at` on the D1 games row ships in the v1 schema**
     (user's call) — NULL = history in the DO; v1 never reads/writes it.
- **R2 cold tier later, on paid**: age-based sweep writes the frozen blob to
  a private `GAME_HISTORY` bucket, drops DO storage, stamps `archived_at`;
  replay reads DO-if-present-else-R2 behind the same interface. Free runway
  ≈ 125k–250k finished games in the 5 GB account-wide DO SQLite quota.
- **Avatars = opt-in R2, built in v1** (§5.4): default `avatar_url` is the
  Firebase provider photo (Google supplies one, Apple doesn't, guests none →
  client renders initials) — zero storage. Uploads enabled via an `avatars`
  config block on `createEngine` (absent → route not mounted). Developed and
  tested entirely under **local R2 simulation** (`wrangler dev` /
  vitest-pool-workers use `.wrangler/state` — no card, no bucket, no account
  call). A card enters only at `r2 bucket create` for a deploy with uploads
  enabled. If `GAME_HISTORY` exists later, two buckets stay forced (R2
  public access is bucket-level; history is private forever). v1 serves
  avatars via a worker route with `Cache-Control`.

### D1 & waiting room
- **D1 simplifications**: users + user_profiles merged into one table;
  game_outcomes folded as JSON into the game_summaries row; only
  rating_history stays a per-user-indexed table besides player_ratings.
  **NO app_players denormalization** (user constraint) — keep the batch
  `players?ids=` endpoint; the client's SQLite-persisted playerInfo cache
  makes it warm.
- **Waiting room**: D1 never arbitrates, only displays. Create =
  worker→D1 direct (game + summary row, creator seat 0, short_code retry);
  DO lazy-inits via `blockConcurrencyWhile` on first command/socket.
  join/leave/cancel/add-bot/start = Commands to the DO (policy checks at the
  worker BEFORE minting — no D1 reads inside the gate; integrity in the DO).
  D1 summary updated post-commit. Client opens the socket pre-start: DO
  pushes unversioned idempotent roster SNAPSHOTS pre-game; versioned frames
  begin at v0. Cancel/abort = no history object, drop DO storage. Lobby
  staleness accepted (join fails cleanly at the DO).
- **Keep from Supabase era**: rating CAS loop (fixes the documented
  concurrent-rated-finish lost-update bug), short_code + retry, bot HMAC,
  FCM, OpenSkill ported as-is, LIKE search first (D1 FTS5 later).

### Web & deep linking (§2.4)
- The game worker IS the link host: static assets binding on the same
  wrangler.jsonc; engine generates both `.well-known` files
  (assetlinks.json + AASA) from `deepLink` config on `createEngine`, plus a
  `/j/:shortCode` OG landing page reading D1. `run_worker_first:
  ["/api/*", "/.well-known/*", "/j/*"]`. Implementors: own domain via
  custom_domain, else free workers.dev — links work day 0.

### Tooling
- hono + @hono/zod-openapi + zod; jose; **drizzle for both stores** —
  D1: `drizzle-kit generate` → `wrangler d1 migrations apply` (never
  runtime migrate/push); DO SQLite: `durable-sqlite` driver, bundled
  `migrations.js`, `migrate()` inside `blockConcurrencyWhile` (user chose
  this over raw DDL). vitest-pool-workers for tests; tsup for builds;
  biome; changesets + GitHub Packages private npm. ES2024, Node 24, one
  root pnpm lockfile.

## 5. Cross-repo contracts

- **Twin implementations**: game rules exist as TS (server-authoritative)
  and Dart (client-side optimism/preview). Shared **JSON fixtures per
  version unit** are run by both TS and Dart test runners to catch drift —
  this pattern already exists in the Supabase-era code and carries forward.
- **Versions-first GameRules**: one rules unit per `schema_version`
  (`v1/` folder convention, versions map, sparse keys); never branch on
  version inside logic.
- **Observations**: append-only observation history per (game, seat,
  version); cause-aware `computeObservation` cues; game-owned optimism
  (`previewAction` + `ActionSubmitResult`); actions taxonomy: game vs
  lifecycle actions.

## 6. Immediate next steps

1. **User** finishes §15: vitest-pool-workers wiring, package src stubs,
   `packages/server`, hello-world verified under `wrangler dev`.
2. **Claude** then starts `@eigen/rules` + `@eigen/kernel`: contract types,
   RPS rules as the first version unit, twin fixtures, timing/grace/
   same-view under unit test. Then §14 phases in order.
3. Deferred small items: delete `examples/temp/` when done with it; decide
   in Phase 2 how `@eigen/server` (a library, not a worker) gets runtime
   types.

## 7. Standing user constraints (do not violate)

- jose, not `firebase-auth-cloudflare-workers`.
- No retry machinery in v1 — single attempt + error log everywhere
  (bot wakes, outbox, FCM).
- No app_players denormalization.
- Versions strictly serial, no gaps, ever.
- CLI-first: real CLI output beats doc snippets in §15 (exception:
  `exports` over the legacy DO `migrations` array).
- No real R2 bucket creation, no payment method, until the user says so.
- Keep `../eigen_engine/docs/engine_stack.md` and its decisions current
  when anything here changes — it is the record.
