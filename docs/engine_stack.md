# Eigen Engine — Architecture of Record (Cloudflare-native)

> **Decision (2026-07-14, design locked 2026-07-15).** The engine runs **Cloudflare-only**:
> Workers at the edge, one **Durable Object per game** owning that game's state — live
> *and finished*: the DO's SQLite **is** the game's history (§4.6) — **D1** for global
> data, **Firebase Auth** for identity. **R2** is opt-in (avatar uploads — v1 code,
> simulated free in local dev) or later (history cold tier) — §5.4. No Postgres. No
> Supabase.
>
> **Two sets of keys: a Cloudflare account and a Firebase project.** Nothing else.
>
> **The constraints that drove it:** fast time-to-first-game, **scale to zero** when idle,
> **~$10/month** at real traffic. We start on the **Workers free plan** — everything the
> design needs (SQLite-backed DOs, alarms, hibernation, D1, cron) is on it, **with no
> payment method on file** (which R2 would require even for free use — §5.4) — and
> upgrade to paid ($5/mo) at the traffic trigger defined in §10. The upgrade is one click,
> zero code change.
>
> **Cutover is big-bang.** The Supabase stack (documented in `engine_architecture.md` in
> the `eigen_engine` repo, now the *legacy* reference) is frozen bugfix-only; `supabase/`
> is deleted from that repo at parity. There are no production users, so there is no data
> migration.

This document is the **final architecture**: every design decision below is settled, not
proposed. `engine_architecture.md` (in `eigen_engine`, the sibling Dart repo) remains the
reference for the frozen Supabase system —
useful because most *semantics* (hooks, timing, ratings, bots, guests, deletion) carry over
verbatim; only the *host machinery* changes.

**Contents.** §1 stack · §2 repos & packages · §3 the core (kernel, DO, commands, same-view
rule) · §4 game lifecycle end to end · §5 data · §6 identity · §7 push & bots · §8 failure
policy · §9 client · §10 cost · §11 CI & testkit · §12 non-negotiables · §13 what we gave up
· §14 build plan · §15 repo setup instructions · Appendix: rejected alternatives.

---

## 1. The stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Client | **Flutter** — opinionated, the only client | `firebase_auth`, FCM, Analytics, Crashlytics |
| Identity | **Firebase Auth** | Google · Apple · **Anonymous**, `linkWithCredential` guest→permanent upgrade |
| Edge | **Cloudflare Workers** (hono) | Stateless: verify token (**jose**), serve D1 reads, mint commands, route to DOs |
| Game session + history | **One Durable Object per game** | SQLite-backed; owns state, roster, sockets, the alarm — and is retained after finish as the game's history (§4.6) |
| Global store | **D1** | Identity, social, bots, ratings, game summaries — a **read-model + registry, never an arbiter** |
| Blobs (opt-in / later) | **R2** (§5.4) | `AVATARS`: profile-photo uploads — v1 code, opt-in per app · `GAME_HISTORY`: future cold tier for old finished games. Local dev simulates R2 free; a *real* bucket (deploy) requires a payment method |
| Push | **FCM**, sent from the Worker/DO | Service-account JWT minted with WebCrypto — ported as-is from `_engine/fcm.ts` |
| Scheduled work | **DO alarms** (turn deadlines — *only*) · **Cron Triggers** (guest purge) | No alarm multiplexer — see §8 |
| Rules | **Pure TypeScript `GameRules`**, unchanged contract | One unit per `schema_version`; optional Dart twin for preview |
| Token verify | **`jose`** + ~40 lines of Firebase claim checks | Deliberately not `firebase-auth-cloudflare-workers` (unofficial, low adoption) |

---

## 2. Repos & packages

Two repos, one contract artifact between them: **`openapi.json`**, generated in the server
repo and vendored into the Dart repo for codegen.

### 2.1 `eigen-server` — TS pnpm monorepo (new)

```
eigen-server/
  packages/
    rules/      @eigen/rules      the implementor contract (types only)
    kernel/     @eigen/kernel     pure commit() → CommitPlan. No I/O, no platform.
    server/     @eigen/server     everything that deploys: DO + routes + D1 (+ opt-in R2)
    testkit/    @eigen/testkit    twin-fixture runner + runtime scenarios + leak/hibernation tests
  examples/
    rps/                          first implementor (simultaneous-move — hardest case first)
```

Four packages, three boundaries that matter: **contract vs engine** (`rules`/`kernel` —
implementors pin the contract; kernel internals churn freely), **pure vs platform**
(`kernel`/`server` — kernel's package.json never lists `workers-types`, so purity is
enforced by the module graph, not discipline), **prod vs dev** (`server`/`testkit`).
A DO class is exported from the same worker script — one bundle, one deploy — so
DO/routes/D1 are folders inside `server` (`src/do`, `src/routes`, `src/d1`), not packages;
that split models a separation Cloudflare itself doesn't have. (If a future self-host
ever wants the DO logic behind a different HTTP layer, the re-split follows the existing
folder lines.)

**`@eigen/rules`** — the one package a game author must understand. Ported near-verbatim
from `_types/engine.types.ts`: `GameRules` (six hooks: `initialState`, `applyAction`,
`applyLifecycle`, `computeObservation`, `ratingPool`, `botSeatable`), `GameModule` (the
`versions` map keyed by `schema_version`), `Envelope`, `OutcomeEntry`, `HookContext`,
`IllegalMoveError`, the `Rng` interface, `passthroughObservation`. Schema slots are typed
against **Standard Schema** (implementors bring Zod/Valibot/ArkType). Dep:
`@standard-schema/spec` (types only).

**`@eigen/kernel`** — `commit(input) → CommitPlan | Rejected` (§3.1). Contents: `timing.ts`
(deadline precedence chain, bank deduction, Fischer increment, the **single grace constant**
— ports of `compute_next_deadline` / `deadline_expired` / the clock logic in
`engine_commit_action`), `observe.ts` (per-seat projection fan-out, cause cues, replay
projection), `rng.ts` (`rand-seed` sfc32 derived from `'<seed>:<version>'`, identical to
today), `ratings.ts` (OpenSkill, multi-seat bot collapse, `RatingDelta[]`), `guards.ts`
(`assertHookState`, `assertBudgetPending`, `assertForfeitPending`,
`assertPendingIdentified`, and the **same-view rule** §3.5). Deps: `openskill`, `rand-seed`,
`@eigen/rules`. Zero platform imports, injected clock — forever.

**`@eigen/server`** — the deployable, in three folders:

- `src/do` — `BaseGameDO`, the abstract DO class an implementor subclasses with its
  `gameModule` and a D1-binding accessor, then exports under the name its wrangler
  config binds (the platform-idiomatic shape — cf. the Agents SDK's `Agent`): its
  drizzle SQLite schema (§5.1, applied via the
  `durable-sqlite` migrator during lazy init), the gated `handle()` loop
  (§3.4), waiting-room command handlers (§4.2), lazy init from D1 via
  `blockConcurrencyWhile`, hibernating WebSocket accept + version-ordered fan-out + range
  fetch, the deadline alarm, the finish sequence (§4.5: compaction + D1 apply — finished
  games stay in the DO, §4.6; the later cold-tier sweep will live here too, but ships no
  v1 code).
- `src/routes` — `createEngine(config)`, the hono app factory an implementor exports.
  `auth/firebase.ts` (jose `createRemoteJWKSet` against Google's securetoken JWKS + claim
  checks: `iss`/`aud` = project, `sub` non-empty, `exp`, `sign_in_provider === 'anonymous'`
  for guest gating; provisions the D1 user row on first sight of a token). Routes: commands
  (mint `Command`, route to DO), reads (lobby, friends lobby, history, `players?ids=`,
  search, bots catalog, replay), social writes, avatar upload (opt-in — §5.4), device
  installations,
  account-deletion orchestration, cron handlers (in-band — no HTTP self-auth),
  `bot/action` (HMAC), the gated `admin/games/:id/history`, and the link group (§2.4:
  `.well-known` for both platforms + `/j/:shortCode` landing, driven by `deepLink`
  config). OpenAPI via
  `@hono/zod-openapi`; a script emits `openapi.json`. `fcm.ts` and `bot_auth.ts` ported
  from `_engine/`.
- `src/d1` — drizzle schema (§5.2) + migrations (generated by drizzle-kit during engine
  development, shipped as the package's `migrations/` dir, applied by the app's `deploy`
  script via `wrangler d1 migrations apply` — **engine-owned end to end**, implementors
  never see drizzle; the vendored-SQL migration sync CLI from the Supabase era is dead)
  + query helpers shared by route reads and DO effects (summary upsert, outbox apply
  with `finish_id` dedupe, the rating CAS).

Deps: `hono`, `@hono/zod-openapi`, `zod`, `jose`, `drizzle-orm`, `@eigen/kernel`.

**`@eigen/testkit`** — the twin-fixture runner (node/vitest port of the Deno runner — same
JSON fixture format, existing fixtures work unchanged), the runtime scenario harness (JSON
command arrays replayed under `vitest-pool-workers`), the leak test, the hibernation
assertion (§11).

### 2.2 `eigen_engine` — Dart repo (this repo, evolves)

`supabase/` is deleted at parity. The package splits in two:

- **`eigen_client`** — transport only: Firebase Auth wiring, OpenAPI-generated command/read
  methods (dio; hand-write the thin client if codegen fights), and the **frame stream**
  (WebSocket, version-ordered delivery, gap recovery by range fetch, reconnect resync,
  roster-snapshot handling pre-start). Pure Dart.
- **`eigen_flutter`** — everything else in `lib/` today: Riverpod shell, lobby, waiting
  room, game screen, history, replay scrubber, friends, settings, account deletion, push
  wiring, timing widgets.

Unchanged: every screen, the Dart `GameModule` contract (`buildContent`, twins), theming,
persistence, twin fixtures in Dart CI. (The `LocalBot` isolate driver is deleted with
local bots — §7.)

### 2.3 What an implementor ships

Server — the entire deployable (the shape `examples/rps` ships, verbatim):

```ts
// bravado-server/src/index.ts
import { BaseGameDO, createEngine } from '@eigen/server';
import { gameModule } from './rules';   // GameRules per schema_version — same contract as today

export class GameDO extends BaseGameDO<Env> {
  protected readonly gameModule = gameModule;
  protected d1(env: Env) { return env.MY_D1; }
}
export default createEngine({
  gameModule,
  d1: (env: Env) => env.MY_D1,
  gameDO: (env: Env) => env.GAME_DO,
});
```

(The accessors are the EngineConfig seam — the engine never assumes binding
names; annotate `env` and both type arguments infer.) Plus `wrangler.jsonc`
(bindings from a template; `FIREBASE_PROJECT_ID` in `vars`), `wrangler secret put`, and the
template's `deploy` script (`wrangler d1 migrations apply` + `wrangler deploy`; §5.2).
Tests: a `test/worker.ts` that repeats this entry with
`auth: testVerifier()` from **`@eigen/server/testing`** (a checked-in local
JWKS + `mintTestToken`/`testBearer`; §6 — the same jose verify path as
production, only the key source differs), bound by a test-only wrangler
config for `vitest-pool-workers`. Client: depend on `eigen_flutter`, register the Dart
`GameModule` + `BoardView`, `flutterfire configure`. The implementor writes **rules TS, a
board widget, and an optional Dart twin** — nothing else. Packages are consumed from a
private GitHub Packages npm registry (OSS-shaped, private-first).

### 2.4 Web & deep linking — the game worker is the link host (SHIPPED — Milestone D, 2026-07-20)

The deployed game worker carries a **static assets binding** and serves three things from
one host:

1. **The API + GameDO** under `/api/*` — everything above.
2. **`/.well-known/assetlinks.json` + `/.well-known/apple-app-site-association`** —
   worker-generated (both platforms, correct content types) from `createEngine` config:
   the implementor supplies Android package + SHA-256 fingerprints and Apple team/bundle
   ID. One source of truth; no hand-maintained JSON files.
3. **Join/share landing pages** — `/j/:shortCode` rendered by a worker route that reads
   the D1 summary (game name, host, open seats) for real OG tags, then deep-links into
   the app with a store fallback. Everything else (screenshots, marketing) is plain
   static assets in `public/`.

So **deep-link host == API host**: one custom domain, one cert, one deploy, and the share
URL users see is the host the app already talks to. Free-tier synergy: static-asset
requests are **unmetered** (they don't count toward the 100k req/day cap); a request that
matches no static file falls through to the worker on its own — so the dynamic paths
(`/api/*`, `/.well-known/*`, `/j/*`, `/avatars/*`) reach it without any `run_worker_first`
listing. The only discipline is not to add a `public/` file that shadows one of them.

Host story for implementors: bought a domain → zone + `custom_domain` on the worker; no
domain → the free `<name>.<account>.workers.dev` subdomain. App Links and Universal Links
accept any HTTPS host, so links work on day 0 either way — the opinionated path is
"deploy the engine worker, your links already work."

House estate (`eigeninteractive.com`): apex → Docusaurus engine-docs worker (later;
Workers-with-assets is CF's recommended path over Pages, which is in maintenance);
`bravado.eigeninteractive.com` → the Bravado game worker's custom domain (an exact custom
domain out-ranks `eigeninteractive-web`'s `*.eigeninteractive.com/*` wildcard route — no
change needed there). `eigeninteractive-web` keeps `strategy` until the Supabase app
retires, then shrinks to the apex page until Docusaurus replaces it. Known gap it never
had: no AASA file (no iOS Universal Links for Strategy) — the engine route group emits
both platforms from the start.

Implementation cost: a route group + config fields in `@eigen/server`
(`src/routes/links.ts`, `deepLink` on `createEngine`) — the four-package layout holds.

**As built:** `createEngine` grew a `deepLink` block (`{ android?: {packageName,
sha256CertFingerprints, storeUrl?}, apple?: {appId, storeUrl?} }`); absent → the group isn't
mounted (API-only worker). The app's display name is **not** in this block — it lives in a
required top-level `appName` on `createEngine` (the single source of truth for engine-owned
identity: the `/j` title + OG tags today, FCM titles / share copy later), so it's set once
regardless of which optional blocks are on. The two `.well-known` files are **generated** from
the config (the AASA is served extensionless as `application/json` — the gotcha a static file
gets wrong), and `/j/:shortCode` reads the D1 summary for real OG tags + store-link fallback
(an installed app opens the https URL directly via App/Universal Links, so the page is only
reached when the app isn't installed). These are plain unauthed routes on the **outer app**:
`buildApp` now returns a no-basePath app that mounts `/api/engine` + `/api/bot` and, when
configured, the public `/.well-known/*`, `/j/*`, and `/avatars/*` (§5.4) routes. The
implementor's wrangler adds an `assets` binding (`directory: ./public`) with **no**
`run_worker_first` — a non-matching request already falls through to the worker; everything
else is served unmetered from `./public`.

---

## 3. The core

### 3.1 The kernel is pure — this is the crown jewel

```ts
// @eigen/kernel — zero I/O, zero platform imports, deterministic.
export function commit(input: {
  game: GameRow;        // config, timing mode, rated, schema_version
  state: StateRow;      // state + version + clocks + pending_players
  roster: Seat[];
  intent: Intent;       // action | lifecycle (timeout/forfeit) | start
  now: number;          // injected — never Date.now()
  rules: GameRules;     // the implementor's version unit
}): CommitPlan | Rejected;

export type CommitPlan = {
  nextState: StateRow;
  frames: ObservationFrame[];   // per seat, already projected — no raw state escapes
  outcomes?: Outcome[];
  alarm: number | null;         // what the DO must arm (already includes grace)
  effects: Effect[];            // pushes to send, server bots to wake
};
```

Rating deltas are deliberately **absent** from `CommitPlan`: they depend on global
cross-game priors (`player_ratings`), which is D1-domain data the kernel must never
need. The OpenSkill math itself lives in the kernel (`ratings.ts`) and is invoked by
the D1 applier at finish time with fresh priors (§4.5) — `commit()` stays free of
cross-game inputs.

Timing, banks, grace, ratings, hidden-info projection, timeout resolution, and the
same-view rule are unit-testable in milliseconds with no infrastructure. The kernel is also
the insurance policy: if Cloudflare ever becomes untenable, the rules *and* the engine move
— only the host package (`@eigen/server`) does not.

### 3.2 The Durable Object is the game's database

One DO per `game_id`. A live game's transitions never touch a shared database. Three things
follow, and they are the reason for the whole design:

- **Serialization is free** (with one rule — §3.4). Two players acting in the same round
  cannot race; the `FOR UPDATE` chokepoint, the stale-retry loop, and the three-way
  timeout race all cease to exist.
- **Timers are exact.** One alarm at `turn_deadline + grace` fires in the actor that owns
  the state. The client-side expiry nudge, the pg_cron sweep, pg_net, and the Vault secret
  it authenticated with are all deleted with no replacement.
- **Frames come from the socket-holder**, in version order, by construction.

> **Store a transition as ONE row** — `{state, action, timing}` — not the old four-table
> relational shape. A per-game database has no reason to normalize, and the compact
> shape is a ~3.5× difference in the binding free-tier limit (§10). The one exception
> (2026-07-17): per-seat live frames sit in their own `frames(version, player_index)`
> table, because they are live-only (drained by the §4.5 compaction when the outbox
> clears) — splitting them keeps `transitions` append-only immutable (no row is ever
> UPDATEd after commit), which is what makes the table the permanent history verbatim.

### 3.3 Commands, not closures

A Worker always fronts a DO. What crosses that boundary is **data**:

```ts
type Command =
  | { kind: 'join' | 'leave' | 'cancel' | 'start';
      gameId: string; commandId: string; actor: Principal }
  | { kind: 'add-bot';   gameId: string; commandId: string; actor: Principal; botId: string }
  | { kind: 'action';    gameId: string; commandId: string; actor: Principal;
                         seat: number; expectedVersion: number; data: unknown }
  | { kind: 'lifecycle'; gameId: string; commandId: string; actor: Principal | null;
                         type: 'timeout' | 'forfeit' | 'auto_forfeit'; seat?: number };
```

(`action`/`forfeit` carry `seat` uniformly — humans and bots alike; the DO
verifies it belongs to the actor against its roster and rejects otherwise
(§4.2). `timeout`/`auto_forfeit` are system lifecycles: `timeout` carries no
seat (resolves all pending), `auto_forfeit` the purged seat.)

- **Authorization happens at the edge.** The Worker verifies the Firebase token and runs
  every *policy* check (guest gating, friends-access via D1, schema gate, `botSeatable`,
  rated validation) **before minting the command** — a command is self-contained and
  pre-authenticated. All D1 reads a decision needs happen here, never inside the DO's gate.
- **Commands are values** — loggable, retryable, replayable. A CI fixture is a JSON array
  of commands.
- **Every command carries a `commandId`**, deduped at the DO (§3.6).
- **Sockets are routed, not sent**: the Worker forwards the upgrade request; the DO accepts
  the socket itself.

### 3.4 The input gate serializes — provided you obey one rule

> **⚠️ Never await non-storage I/O between reading and writing DO storage.** A `fetch` to
> D1, R2, FCM, or a bot webhook opens the input gate and lets another command interleave.

The shape of `handle()` is therefore fixed:

```ts
async handle(cmd: Command): Promise<Result> {
  if (this.#seen(cmd.commandId)) return this.#replay(cmd.commandId);   // storage
  const snap = this.#load();                                            // storage
  const plan = commit({ ...snap, intent: cmd.intent, now: Date.now(), rules: pick(snap) });
  if ('rejected' in plan) return plan;

  this.#apply(plan);                    // storage — ONE SQLite transaction. Gate held.
  // ── post-commit: interleaving is harmless from here ──
  this.#fanout(plan.frames);            // sockets we hold
  await this.ctx.storage.setAlarm(plan.deadline);   // deadline is the ONLY alarm client
  this.ctx.waitUntil(this.#effects(plan));          // D1 summary, FCM, bot wake — single attempt
  return { ok: true, frame: plan.frames[cmd.seat] };
}
```

Read → compute → write, no network in between. Every network effect happens after the
SQLite commit, where an interleaved command simply reads already-committed state.

### 3.5 Simultaneous moves — the same-view rule

Serialization removes torn writes, but a policy is still needed when a command arrives with
a stale `expectedVersion` (someone else committed while it was in flight):

> A stale-version action is **accepted iff the acting seat's own projected observation is
> unchanged** between `expectedVersion` and the current version — comparing the stored
> frames' `data` + the seat's observed `pending_players` as canonical JSON, ignoring
> version/timing bookkeeping. Otherwise it is rejected with the "state updated" error.

Rationale: the observation *is* the seat's decision basis — that is the whole
hidden-information model. Identical view ⇒ the intent transfers soundly (and `applyAction`
still validates legality against the true current state). Changed view ⇒ the conflict is
genuine, and "state updated — try again" is literally true.

Consequences:

- **RPS works with zero game code**: an opponent's hidden commit doesn't alter your
  observation, so both submissions land regardless of arrival order.
- **Sequential games are automatically strict**: any opponent move changes your view.
- **The implementor controls the policy implicitly through `computeObservation`** — reveal
  an event and it invalidates pending stale submissions; hide it and they survive. No
  flags, no second encoding of the information model.
- Cheap: the frames are already stored per transition (§5.1); the check is a compare of two
  stored blobs. If the `expectedVersion` row is gone, reject conservatively.

**Versions stay strictly serial.** The rule governs *acceptance only*. Every accepted
action commits as the next version in arrival order — one gapless linear chain. (In an RPS
round at `N`: A commits `N+1`; B, stale at `N` but same-view, commits `N+2`.) Frame streams,
gap recovery, replay, and `'<seed>:<version>'` RNG derivation all assume this.
`lifecycle` commands (forfeit/timeout) skip version checks entirely — unconditional intent,
as today.

### 3.6 Idempotency — two keys, two boundaries

Serialization orders commands; it cannot identify duplicates. Any effect that must happen
exactly once, delivered over a channel that can fail after the effect but before the
confirmation, needs an idempotency key on the receiving side. There are exactly two such
channels:

- **`commandId` (client → DO).** A client retries a POST it never saw the response to. The
  DO keeps a `commandId → response` table; a duplicate replays the stored response —
  including the own-move frame — instead of double-applying (forfeit/join) or spuriously
  rejecting a move that actually landed (action). Dropped with the rest of DO storage at
  finish.
- **`finish_id` (DO → D1).** The finish spans two stores with no shared transaction; the
  D1 apply is keyed on `finish_id` so a re-run (including a manual re-poke — §8) is a no-op.

Everything else is either re-derivable (the D1 summary row) or naturally idempotent
(re-sent frames are discarded by the client's version-ordered stream).

---

## 4. Game lifecycle, end to end

### 4.1 Creation — the one worker-direct write

```
POST /games → worker: validate (timing modes, player counts, access, guest gates,
              ratingPool + rated assertion — all of today's TS policy, verbatim)
            → generate game_id + short_code (D1 UNIQUE + retry loop)
            → INSERT the D1 game row (creator = seat 0, status 'waiting')
            → return { game_id, short_code }.   The DO does not exist yet.
```

D1-first is deliberate: existence and lobby visibility have one source of truth, and a game
nobody joins never wakes a DO. The DO lazily initializes from the D1 row via
`blockConcurrencyWhile` on its first command or socket. Short codes are 6 chars from a
no-lookalike alphabet (no 0/O/1/I/L — they're read aloud), retried on the UNIQUE index
up to 5 times.

### 4.2 Waiting room — D1 never arbitrates, it only displays

Every post-creation mutation is a `Command` to the DO, serialized by the input gate exactly
like moves. The policy/integrity split is today's "policy in TS, integrity under the lock",
relocated:

| Command | Worker (policy, before minting) | DO (integrity, under the gate) |
| --- | --- | --- |
| `join` | guest-vs-rated gate; friends-access (D1 relationships); schema gate vs `client_schema_version`; by-code resolves `short_code` in D1 | status `waiting`/`ready`; seat free; not already seated; assign `player_index`; `ready` at `min_players` |
| `leave` | — | non-creator; lobby statuses only; compact `player_index`es; demote below `min_players` |
| `cancel` | — | creator-only; lobby statuses only; status → `aborted`; drop DO storage (nothing worth retaining — the D1 row alone serves history lists) |
| `add-bot` | `botSeatable`; schema / `rated_eligible` / timed invariants; brain-or-webhook exists (§7) | creator-only; seat cap; seat the bot |
| `start` | — | creator-only; `ready`; kernel `initialState` → v0; arm alarm; status `active` |

The D1 summary is updated post-commit via `waitUntil` (fire-and-forget, reconcilable from
the DO). Accepted staleness: the lobby may briefly show a game that just filled; the join
then fails cleanly at the DO ("game full") — the identical UX to today's lobby race.

Landed 2026-07-17, three shipped refinements:

- **Lobby refusals are values, not throws.** The DO answers expected lobby
  races with a `LobbyRejectCode` (`unknown_game`, `not_joinable`,
  `game_full`, `already_joined`, `not_participant`, `not_creator`,
  `creator_cannot_leave`) alongside the kernel's `RejectCode`s; the worker
  maps codes → HTTP (client mistakes 400, ownership 403, missing game 404,
  conflicts 409) and every handler's non-200 path is an `HttpError` throw
  rendered by one app-level error handler. Genuine protocol violations
  (naming a seat the principal doesn't own) still throw across the RPC —
  those are bugs, not races. The creator-only `start` check moved from throw
  to a clean `not_creator` rejection for the same reason: any seated client
  can reach it honestly. Accepted lobby commands answer with the roster
  snapshot (`{ok, roster}`) — there is no version yet to answer with.
- **The DO verifies the acting seat, carried uniformly** (revised twice:
  first away from worker-side D1-mirror resolution — a Supabase-era holdover
  that let the display mirror arbitrate gameplay; then, 2026-07-18, to the
  uniform shape). Every `action`/`forfeit` command carries a `seat` —
  humans and bots alike — and the DO verifies it belongs to the actor (user
  id from the verified token, bot id from the HMAC claim) against its own
  roster, the authoritative copy. A seat the actor doesn't hold is a clean
  `not_participant` **value → 403**, never a throw: it is reachable without
  malice (a stale UI after leaving) and from a misbehaving external bot
  alike. This is forgery-proof because identity still comes only from the
  token/claim (never the request body — the client sends a seat, not its own
  id), and it is one code path for humans and bots, which supports one bot id
  holding several seats (as the Supabase infra did via `player_index`).
  Bonus: `leave`/`cancel`/`start`/`action`/`forfeit` skip the worker-side D1
  existence read entirely — the DO answers `unknown_game` (404) from its
  lazy init when the game row doesn't exist. Only `join` (policy needs the
  game row), the frames read (access policy), and the socket upgrade (don't
  wake DOs for garbage ids) still read D1 first.
- **Roster mirror.** After join/leave/add-bot the DO rewrites the D1 display
  copy wholesale (delete + reinsert participants + games.status, one batch)
  from `waitUntil` — idempotent, immune to per-row drift, and pure display:
  since the seat-resolution revision above, nothing on the gameplay path
  reads it. **Cancel is the exception**: its mirror is awaited (the aborted
  games row is the only survivor of the storage drop), and a
  cancelled-but-unmirrored game re-enters cancel idempotently through the
  `aborted` branch. After `deleteAll()` the DO re-runs its migrations so the
  live instance keeps a schema.
- **Sockets carry the principal, not the seat.** The worker authenticates
  (bearer header, or `?token=` for upgrades — browsers can't set WS headers)
  and stamps `x-eigen-user` (inbound `x-eigen-*` is dropped wholesale); the
  DO stores just `{userId}` in the hibernation attachment and resolves seats
  against the CURRENT roster at every send. A socket opened before joining
  starts receiving its seat's frames the moment its user is seated — no
  re-tagging machinery. Roster snapshots broadcast to every socket (public
  lobby information); the current snapshot also rides the socket open while
  the game is in a lobby status.

**Waiting-room realtime.** The client opens the game WebSocket immediately, pre-start — one
socket for the game's whole lifetime. Pre-game, the DO pushes a **full roster snapshot** on
every change: unversioned and idempotent (a reconnect just gets the current snapshot), so
no ordering machinery is needed for a ~200-byte payload. Versioned, gap-recovered frames
begin at `start` (v0). "Player joined" becomes instant instead of poll-driven.

### 4.3 Active play

Unchanged frame protocol — the best idea in the codebase, now transport-native: append-only
per-seat observations; the own-move frame rides the command response; gaps recovered by
range fetch against the DO's stored transitions; reconnect resyncs from the latest frame.
Bot turns are in-DO post-commit effects (or a webhook wake for external bots — §7); the
old local-bot machinery (`local-bot-action` and its sanctioned DO observation read) is
deleted, not ported (2026-07-18, §7).

### 4.4 Timing — grace collapses to one constant

The timing model (untimed / per-action / budget banks + Fischer increment, the hook's
per-action `turn_seconds` override, the deadline precedence chain, budget-requires-
sequential) ports from `engine_architecture.md` §3 **semantically unchanged**, as pure
kernel code.

The grace window survives — it compensates network physics (server time is measured at
arrival), which no host change fixes — but it collapses from a three-place race-symmetry
requirement into **one constant in `@eigen/kernel`**:

- the kernel accepts an action while `now <= deadline + grace`;
- the DO arms its alarm at `deadline + grace`.

There is no race to referee: whichever arrives first — the latent action or the alarm —
commits; the loser sees already-advanced state and no-ops. Deleted with no replacement: the
client expiry nudge (`game/expire`, `_deadlineTimer`, `kExpiryTriggerDelay`), the
`internal/expire` sweep, pg_cron, pg_net, `serverless_base_url`, and the Vault
`secret_api_key`. The client's `kServerDeadlineGrace` mirror stays display-only; budget-mode
flag-fall semantics (bounded overrun accepted) carry over verbatim.

On alarm fire: run `applyLifecycle({type:'timeout'})` over the whole pending set through the
same `commit()` path — one identity-less system transition, exactly today's semantics.

### 4.5 Finish — the one hard part

`player_ratings` is global (two of one player's games can finish at once), so the atomic
finish Postgres gave us is not recoverable. What replaces it, **simplified by decision to a
single attempt with a safety net**:

1. **The DO's finish is atomic and authoritative.** One DO SQLite transaction: final
   transition `N` — written uniformly like every transition, frames and dedupe row
   included — `status = 'finished'`, per-seat outcomes, and an outbox row with a
   `finish_id`. The instant it commits, the game *is* finished. **Compaction rides the
   outbox clear** (2026-07-17, superseding compact-at-finish): the transaction that
   completes the pipeline — committing ratings transition `N+1` (rated) or just
   clearing the outbox (unrated) — empties the live-only `frames` and `commands`
   tables wholesale. One invariant instead of two: *outbox present ⟺ live rows may
   remain ⟺ finish effects pending*. `transitions` is never touched — append-only by
   construction. A failed D1 apply therefore retains a few KB of live rows alongside
   the outbox row until the idempotent re-poke: same signal, same recovery.
2. **Outcomes ship instantly; rating deltas follow.** The final frame at `N` carries the
   result over the socket the DO already holds — D1 is not in that critical path. Deltas
   are *not* computed here: they depend on global cross-game priors (`player_ratings`),
   which is D1-domain data, and any prior snapshotted into the DO (at start, or per
   command) is stale by construction — games can run for days. They are computed where
   the fresh priors live (step 3) and delivered as one more versioned transition. A rated
   game's client shows "ratings pending" between `N` and `N+1` — which is literally true.
3. **Then:** apply the outbox to D1 — one `batch()`: summary status + outcomes JSON,
   the `player_ratings` CAS (which reads fresh priors and computes the deltas, via the
   kernel's `ratings.ts`), `rating_history` inserts. On success the DO, in one storage
   transaction, appends the **ratings transition `N+1`** (state unchanged; its action is
   the engine-owned `kind: "ratings"` `TransitionAction` variant carrying the deltas —
   never `kind: "game"`/`"lifecycle"`, whose `data` belongs to the game's own
   vocabulary) and **clears the outbox row**, then fans
   `N+1` out. Delivery is versioned, so reconnect gap recovery and replay pick it up by
   construction — no bespoke message type. The post-`await` storage write is safe
   because a finished game accepts no mutating commands. Nothing is copied anywhere: DO
   storage is **retained** — it *is* the game's history (§4.6).
4. **Single attempt, log on failure.** No retry alarm, no reconciliation cron. On any
   failure the DO logs, **keeps the outbox row**, and `N+1` simply doesn't exist yet. The
   failure mode is "game missing from history lists/leaderboard, deltas pending, until
   re-poked", not data loss; a gated admin re-poke re-runs step 3, safe because of
   `finish_id`, and commits `N+1` late — every client's stream picks it up. (The alarm
   remains deadline-only.)
5. **The rating write is a CAS.** Read `(mu, sigma, version)`, compute in TS,
   `UPDATE … WHERE version = ?`, recompute on conflict. This *fixes* the documented
   concurrent-rated-finish lost-update bug in the legacy stack (`engine_architecture.md`
   §8) rather than porting it. And because the delta is computed at the same place it is
   committed, the displayed delta always equals the stored one — the old "CAS conflict
   revises a delta already displayed" seam is gone, not merely rare.
6. **The rating write carries a purge guard.** Before writing, the apply reads which of the
   seats' user-ids still exist and **skips the rating write (and the returned delta) for any
   that don't** — a seat whose account was deleted mid-game still carries its id in the DO
   roster (the purge never wakes the DO), and a later rated finish must not resurrect a
   `player_ratings` row for it. The purged seat still shapes the OpenSkill field; only its own
   write is skipped. Mirrors the old `apply_rating_updates` existence guard (§4.7).

(Decided 2026-07-16, superseding "deltas ship in the final frame": start-time priors are
guaranteed stale for long games, per-action D1 prior reads tax every rated move to serve
only the one that finishes, and client-side polling reinvents retry machinery on the
phone. Computing at the CAS and delivering as `N+1` reuses machinery that must exist
anyway.)

### 4.6 Game history & replay — retained in the DO, projected on read

**Finished games stay where they were played.** The DO's SQLite — meta, roster, the full
transitions chain, outcomes, rating deltas — is retained after finish (compacted, §4.5)
and *is* the game's history. Nothing is copied out; the finish sequence has no blob write
and no second failure branch. On Cloudflare this is a first-class pattern, not a
workaround: a DO is an addressable SQLite database that costs nothing while idle except
storage, and "one DO per entity as its permanent database" is platform-endorsed.

**Replay is the live range-fetch path, pointed at a finished game.** The worker owns the
rules module, so the replay endpoint projects on read — `computeObservation(…, isReplay:
true)` per version, with the caller's seat, or `player_index = null` for a
non-participant viewing a public game. Exactly today's EF replay semantics: post-game
hidden-info reveal and viewer replay work *by construction*, and raw state remains
server-only — the single replay endpoint is the only reader, and it gates (finished +
participant-or-public) then projects before returning. It takes a **version range** (the
client pages through, same as live gap recovery), which keeps a single invocation's
projection work comfortably inside even the free plan's 10 ms CPU budget regardless of
game length or rules weight. This widens the §5.2 never-wake-a-DO exception list by one
entry: replay is a deliberate single-game deep read — the same species as live gap
recovery — not the list traffic the rule protects.

**What retention trades away — and the cold tier that buys it back.** Keeping the record
inside a live class costs four system-of-record properties: DOs are **not enumerable**
(an iterate-all-histories job is a D1-driven fan-out, not a bucket `list`); the DO
schema **never freezes** (every migration must stay valid for the oldest finished game,
since the durable-sqlite migrator runs on wake); the record is **mutable by
construction** (a bad deploy *can* touch it — softened by DO point-in-time recovery's
30-day window); and DO storage is ~13× R2's price per GB. All four are fleet-scale
concerns, so the remedy is deferred, not deleted: once on the paid plan (a payment
method exists — the same thing that unlocks R2, §5.4), an age-based **cold-tier sweep**
writes each old finished game as one frozen JSON object to the `GAME_HISTORY` bucket
and drops the DO's storage; replay reads DO-if-present, else R2. The blob is the §5.1
data verbatim:

```jsonc
{
  "game": { /* config, timing, rated, pool, schema_version, … */ },
  "roster": [ /* seats with identity refs */ ],
  "transitions": [ { "version": 0, "state": …, "action": null, "pending": […], "timing": … }, … ],
  "outcomes": [ … ],
  "ratingDeltas": [ … ]
}
```

**Raw history, no frames** — same as what compaction leaves in the DO, so the
reveal/viewer projection logic is identical against either store. Why the cold tier is
R2 and not a D1 blob column: D1 has a **hard 10 GB/database ceiling** (≈ one month of
history objects at target scale) and a 2 MB row cap; R2 is unbounded at ~$0.015/GB-month
with zero egress. History *lists*/lobby/leaderboard never read the DO or the blob — they
read D1 summaries. (KV was considered as a card-free blob store and rejected —
appendix.)

**V1 ships the hot path only (decided 2026-07-16).** No sweep and no DO-vs-R2 read
branching — replay reads the DO, full stop. What makes the cold tier a drop-in later is
four seams v1 *does* build:

1. **The replay contract is store-agnostic.** The client asks the worker for a version
   range and gets projected frames; nothing in the API says where history lives. The
   source can change without a client release.
2. **The read seam is a named interface (SHIPPED — Milestone C).** The replay route fetches
   through the ~20-line `HistoryStore` interface (`history/store.ts`), which v1 ships with
   exactly **one** implementation (`doHistoryStore`, the DO range fetch) and no dispatch
   logic. `getFrames` routes finished-game reads through it; live gap recovery stays a direct
   `stub.frames()`. The cold tier later adds the R2 implementation and a DO-if-present-else-R2
   composition behind the same interface — the route never changes.
3. **Compaction leaves exactly the blob.** The post-finish DO rows are field-for-field
   the cold-tier object above, so the sweep is a straight serialization — no transform,
   no schema reconciliation at archive time.
4. **The discriminator ships in the schema from day 0.** The D1 games row carries a
   nullable `archived_at` (§5.2) — `NULL` means the history lives in the game's DO,
   which is every row until the sweep exists. V1 never writes or reads it; the sweep
   just starts stamping it. Being data rather than code, it costs nothing to carry.

### 4.7 Account deletion & guest purge (SHIPPED — Milestone C, 2026-07-20)

Same *outcome* as `engine_architecture.md` §22/§25 — but the ordering is CF-native, not a
port of the Supabase transaction. The one shared path is `purgeUser` (`lifecycle/purge.ts`),
run by the `DELETE /api/engine/me` route and the cron alike.

**Order is games → Firebase → D1, and that order is load-bearing.** The old stack deleted
`auth.users` *inside* the SQL transaction. Here Firebase is a separate system, and our auth
middleware **re-provisions a `users` row on any valid token** — so deleting the D1 row while
the Firebase account still lives would let the very next request resurrect the user. So:

1. **Clear the user's live games.** Read them through the participants index and, per game,
   forfeit (active), cancel (a lobby they created), or leave (a lobby they joined) — a
   `lifecycle`/`cancel`/`leave` command to each DO. A rated forfeit applies its ratings here,
   while the user row still exists. Single attempt each (§8); a refusal/failure logs and the
   purge continues (an orphaned seat is caught by the reap/timeout, never blocks the delete).
2. **Delete the Firebase account** via the Identity-Toolkit admin REST endpoint
   (`accounts:delete`, `{ localId, targetProjectId }`, scope `identitytoolkit`), signed with
   the same service-account JWT machinery FCM uses (`google/oauth.ts`). Single attempt. On
   failure `purgeUser` **throws before touching D1** — nothing is half-deleted, the account
   stays fully retriable (the route returns 502; the cron logs and retries next run).
   `USER_NOT_FOUND` counts as success (idempotent re-run).
3. **Purge D1** as one `batch()`. D1 has no FK cascades, so the §22 preserve-vs-delete is
   explicit: `participants.user_id` and `games.created_by` are SET NULL (finished-game
   history stays readable as "Deleted User"); `player_ratings`, `rating_history`,
   `relationships` (both sides), and `device_installations` are deleted; the `users` row goes
   last.

The DO roster's `user_id` is deliberately **not** nulled (that would mean waking every
still-active game). A seat is identified by `player_index` in every projection path, so a
lingering roster `user_id` is server-only and harmless — with one exception the finish apply
closes: a 3+ player game the purged user forfeited may keep playing and later finish rated,
at which point `applyFinish` would write a `player_ratings` row for the deleted user. So the
finish apply carries a **purge guard** (§4.5): it reads which seat user-ids still exist and
skips the rating write (and the returned delta) for any that don't — the surviving players
are still rated against the full OpenSkill field. Mirrors the old `apply_rating_updates`
existence guard.

If `FIREBASE_*` is unset, step 2 is skipped with a warning (the D1 data is reclaimed but the
credential is not — configure the service account for full deletion; tests never re-request).

**The cron backstop is a `scheduled` handler, and it is NOT a timeout sweep.** The old stack
ran a cron scanning `game_states.turn_deadline` to force-expire overdue turns, purely because
Postgres has no per-game timer. Our **DO deadline alarm is that timer** — durable, per-game,
platform-retried (§4.4/§8) — so turn timeouts never need a sweep, and none is built. The
handler (`lifecycle/cron.ts`) does only what has no per-entity timer of its own:

- **Stale-guest purge** — anonymous accounts older than 7 days with no game activity in the
  last 2 days (old §25 windows), torn down through `purgeUser` in-band (no HTTP hop, no shared
  secret). "Activity" is the newest `updated_at` among the guest's participated games (one
  correlated `NOT EXISTS`), since there is no per-request last-seen column.
- **Abandoned-game reap** — never-started lobbies past 7 days, and **untimed** active games
  (which have no alarm at all) idle past 30 days, `abort()`-ed. `BaseGameDO.abort(gameId)` is
  an unconditional teardown (no creator gate, works pre-init): mirror `aborted` to D1, drop
  the DO's storage. The only backstop that ever ends an abandoned untimed game.

Both jobs are best-effort, isolated (one failure never blocks the other), and batch-capped
(200 guests / 500 games per run) so a backlog drains over days rather than in one invocation.
The windows and batch caps are `LIFECYCLE_DEFAULTS` in `lifecycle/cron.ts`, each overridable
via an optional `lifecycle` block on `createEngine` (`{ guestMaxAgeMs?, guestInactivityMs?,
lobbyTtlMs?, untimedActiveTtlMs?, guestBatch?, reapBatch? }`) — set any subset, inherit the
rest.

---

## 5. Data

### 5.1 DO SQLite — the game

| Table | Contents |
| --- | --- |
| `meta` | The game row snapshot (from lazy init) + status + `rng_seed` |
| `roster` | Seats: `player_index`, identity ref (user/bot), type |
| `transitions` | **One row per version, append-only immutable**: `{state, action, pending, deadline, player_times, turn_started_at}` — the engine-owned envelope as typed columns, `state` as the game's opaque payload. Serves live gap recovery and (post-finish) replay |
| `frames` | Per-seat live projections, PK `(version, player_index)` — socket gap recovery + the §3.5 same-view compare. **Live-only**: emptied wholesale when the outbox clears (§4.5 compaction) so `transitions` never needs an UPDATE |
| `commands` | `commandId → response` dedupe (§3.6) — deleted at finish |
| `outbox` | The finish payload + `finish_id` (§4.5) — cleared once the D1 apply succeeds |

**Retained at finish** — the compacted database *is* the game's history (§4.6), until
the later cold-tier sweep moves it to R2. Dropped at cancel/abort (immediately; the D1
row alone serves history lists).

**Schema is drizzle, same as D1** — defined in `src/do/schema.ts`, applied with
`migrate()` from `drizzle-orm/durable-sqlite/migrator` inside the existing
`blockConcurrencyWhile` lazy init. A second drizzle-kit config (`driver:
'durable-sqlite'`) generates a `migrations.js` bundle that compiles into the worker —
no filesystem, no deploy step; each DO migrates itself on first activation. This buys
typed queries in DO code, one ORM across both stores, and automatic migration of any
live game that survives a deploy which changes the DO schema (raw DDL would have relied
on "games are short-lived"). Cost: drizzle's journal table adds a few rows per game —
noise against the ~70-row §10 budget.

The `durable-sqlite` driver is fully **synchronous** (`.get()`/`.all()`/`.run()`;
`db.transaction` wraps `storage.transactionSync` and takes a *non-async* callback, so an
`await` inside it is a syntax error) — the entire §3.4 gated hot path therefore runs on
typed drizzle queries with the one-transaction atomicity guarantee made structural. No
raw SQL, no hand-mapped rows: row types are `$inferSelect` off the schema.

### 5.2 D1 — the global store, and it is small

| Table | Notes |
| --- | --- |
| `users` | **Merged** `users` + `user_profiles` (the split served RLS separation that no longer exists): uid (Firebase), username, email?, display_name, avatar_url, is_anonymous, timestamps |
| `games` | The summary/read-model row: status, access, `schema_version`, config, rated/pool, `short_code` (UNIQUE), min/max players, `pending_players` + `turn_deadline` (dashboard), `outcomes` **JSON** (at finish), `finish_id` + `finished_at` (stamped by the finish apply; the future abort path stamps `finished_at` too), `archived_at` (nullable; `NULL` = history lives in the DO — stays `NULL` until the §4.6 cold-tier sweep exists), timestamps. Indexed: (status, access), created_by, and the partial lobby index (`created_at` WHERE public + waiting/ready), all ported |
| `participants` | The roster join table, ported as-is — one row per seat (`game_id`, `user_id`/`bot_id`, `player_index`, `type`), THE indexed access path for "games of user X" (SQLite cannot index into a JSON array; a 2026-07-17 audit reverted a brief JSON-snapshot detour). Game-scoped unique indexes on (game_id, user_id) and (game_id, player_index) guard the join race; the DO's roster stays the integrity copy |
| `relationships` | Friends — canonical pair order + UNIQUE, as today |
| `bots` | Registry (§7): `type` (`engine`/`external`/`local` — replaces `is_local`), `username` (UNIQUE — the key `GameRules.botActions` uses for engine brains), `webhook_url` (nullable; two CHECKs make it present ⟺ `external`), `schema_version`, `rated_eligible`, `config` |
| `player_ratings` | Per identity per pool: mu, sigma, display, **`version` (CAS counter)** |
| `rating_history` | Immutable per-game log, keyed for the per-user history screen; unique on (`game_id`, identity) *and* carrying `finish_id` |
| `device_installations` | FCM targets (FID-keyed), unchanged |

Deliberate simplifications: `game_outcomes` is **JSON on the games row** (history reads are
"my games + my result" through the participants index — no per-outcome table needed);
**no identity denormalization** into the games row — the batch `players?ids=` endpoint
(today's `app_players` twin) plus the client's SQLite-persisted `playerInfoCacheProvider`
makes identity lookups cache-warm; user search is `LIKE` (D1 supports FTS5 if it ever
matters); `private.app_config` and Vault become `wrangler.jsonc` vars and secrets.
A 2026-07-17 old-vs-new schema audit restored four dropped items: the `participants`
table, `games.finished_at`, the partial lobby index, and `blocked` in the relationship
status type (Dart-twin parity; still logic-free). Knowingly dropped: `users.payment_tier`
(modeled but never read by any server logic — reinstate only with a real billing
feature) and the trigram search indexes (the LIKE decision above). The old
`game_states.turn_deadline` sweep index was **not** ported: Milestone C's cron builds no
timeout sweep (the DO alarm owns turn deadlines — §4.7), and its abandoned-game reap filters
on `status`/`created_at`/`updated_at`, already indexed.

**Migrations are engine-owned; the engine's D1 is engine-private** (decided 2026-07-17,
superseding a briefly-adopted app-owned layout the same day). The product principle wins:
an implementor's mental model is `createEngine` + a `GameModule` — never drizzle,
schemas, or migrations. The engine's D1 database is private to the engine exactly like
the DO's SQLite: migrations ship inside `@eigen/server` (`migrations/` in the published
package), wrangler's `migrations_dir` points at
`node_modules/@eigen/server/migrations`, and the scaffold's `deploy` script runs
`wrangler d1 migrations apply <binding> --remote && wrangler deploy` — schema and code
move in lockstep, the same way the DO's bundled migrations ride the code. A package bump
can't drift from the deployed schema because apply-before-deploy is the only deploy path.
Implementors wanting custom data create a **separate second D1 database** — wrangler's
`migrations_dir` is per `d1_databases` entry, so their own drizzle (or anything else)
coexists without ever touching the engine's database or its journal. App tables inside
the engine's database are rejected outright: the engine must be free to evolve its schema
without colliding with unknown tables. The engine's own repo keeps its generate-only
drizzle-kit config; `drizzle-kit generate` there is an engine-development act, invisible
downstream.

> **Rule: never wake a Durable Object to serve a read.** Lobby, history lists, profiles,
> search, players, bot catalog: Worker → D1. Only commands, the WebSocket, and range
> fetches (live gap recovery *and* finished-game replay — §4.6) touch the DO.

### 5.3 RLS is gone; the kernel is the guarantee

Nothing but the engine touches the data. Hidden-information safety lives entirely in the
kernel: it projects per-seat frames, and **no route exposes raw state** — none is written.
This is a real reduction in safety margin, paid for in tests: the **leak test** (§11)
asserts no response body ever carries an unprojected state field, and it exists before the
first game ships.

### 5.4 R2 — opt-in and later; the engine core needs no payment method

R2 is the one primitive we'd use that **requires a payment method on file even for
free-tier use** — for *real* buckets. Local dev is exempt: `wrangler dev` and
vitest-pool-workers simulate R2 inside `.wrangler/state` with no card, no real bucket,
and no account call, so R2-backed features are built and tested for free. The engine's
*required* path never touches R2 either way — an implementor runs games, replays, and
profiles with no card, ever. Two features pull real R2 in:

| Bucket (dev names) | Binding | When | Contents | Access |
| --- | --- | --- | --- | --- |
| `eigen-avatars-dev` | `AVATARS` | **V1 code, opt-in per app**: the implementor enables profile-photo uploads via an `avatars` config block on `createEngine` (absent → the upload route isn't mounted, no binding needed). Built and tested under local simulation from day 0; the card enters only when deploying with uploads enabled | User avatar images | World-readable — the highest-frequency blob read in the app |
| `eigen-game-history-dev` | `GAME_HISTORY` | **Later**: the §4.6 cold-tier sweep, once on the paid plan (a card exists by then anyway); v1 ships only the single-implementation `HistoryStore` read seam — no sweep, no branching | One frozen raw-history object per old finished game | **Private forever** — raw state carries hidden info (non-negotiable 9); the replay endpoint is the only reader and projects before returning |

**The default avatar costs zero storage anywhere**: `avatar_url` carries the Firebase
provider photo (Google supplies one; Apple doesn't; guests have none — the client
renders initials for those). Photo uploads are a product decision, not an engine
requirement.

If both buckets exist, two-not-one stays forced: **public access in R2 is a bucket-level
switch** (r2.dev or a bucket custom domain — no per-prefix policy), and these datasets
sit at opposite ends of it. Disambiguation: a user's game-history **list** is D1 summary
rows (§5.2); a game's full raw history lives in its DO (§4.6) until the sweep freezes it
into R2, read only by replay either way.

**Avatar upload & serving (SHIPPED — Milestone D, 2026-07-20).** R2 has no RLS and no
client-direct writes (unlike the Supabase-era client-direct-to-Storage flow), so uploads go
through the worker: a **raw-binary `PUT /api/engine/me/avatar`** (authed; `Content-Type`
`image/jpeg|png|webp`, ~2 MiB cap) streams the image to R2 under key = uid, then stores
`avatar_url`. Serving: a bucket custom domain requires a CF zone free-`workers.dev`
implementors lack, and r2.dev is rate-limited / non-production — so the default is a **worker
route `GET /avatars/:uid`** (public, `Cache-Control: immutable, 1yr`). The stored `avatar_url`
carries `?v={ts}` (the R2 key is overwritten on re-upload, so the URL must change for clients
to refetch). An optional **`avatars.publicBaseUrl(env)`** points `avatar_url` straight at a
bucket custom domain (or r2.dev) so reads never touch the worker — an `env` accessor, so dev
(unset → worker route) and prod (a var → direct) differ with no code change. **This is the
promised flip, now a config value from day one, not a later rewrite.** The private/public
split still stands: `GAME_HISTORY` is private forever. Account deletion (§4.7) deletes the
avatar object best-effort. Config: `avatars: { bucket(env), maxBytes?, publicBaseUrl?(env) }`;
absent → the routes aren't mounted and no R2 binding is needed. Built and tested entirely
under local R2 simulation.

---

## 6. Identity — Firebase Auth

Already run for FCM/Analytics/Crashlytics: no new vendor, no new keys.

- **Google + Apple + Anonymous** (Apple is mandatory alongside Google on iOS — Guideline
  4.8; true today as well).
- **`linkWithCredential`** upgrades guest → permanent **preserving the UID** — the entire
  §25 guest lifecycle (generated `player_NNNNN` handle, profile backfill on conversion,
  switch-into-existing-account on `credential-already-in-use`) ports with Firebase doing
  the hard part.
- The ID token's `firebase.sign_in_provider === 'anonymous'` drives every guest gate (no
  rated, no social, no search; bot games allowed, unrated — §7) — same checks, same
  places (worker policy).
- Verification: `jose` `createRemoteJWKSet` against Google's securetoken JWKS (cached per
  isolate) + Firebase claim checks (`aud` = project id, `iss` =
  `https://securetoken.google.com/<project>`, `sub`, `exp`). ~40 lines of our code. Only
  `FIREBASE_PROJECT_ID` is needed to verify; the service-account trio is for FCM sends and
  account deletion.
- A `users` row is provisioned in D1 on first sight of a token (replaces `handle_new_user`).
  Landed shape: the auth middleware does one D1 read per request; it writes only on first
  sight and on guest → permanent conversion (the uid is stable across
  `linkWithCredential`, so it's an UPDATE on the same row). The old trigger's username
  rules port intact (revised 2026-07-18; the first-landed shape generated `player_NNNNN`
  for everyone): with an email, the handle is the sanitised local part (lowercased,
  `[a-z0-9_.]`, 3–20 chars, `player` fallback), collisions retry as
  `base[:15]_NNNN`, 10 attempts; guests get `player_NNNNN`. Display name/avatar seed
  from the provider claims (`name`/`picture`). Conversion follows the old product
  decision: the provider's name and avatar OVERWRITE the guest's, the username stays
  the stable handle.
- **Test strategy** (landed 2026-07-17): `@eigen/server/testing` ships a checked-in
  RS256 keypair (a public fixture protecting nothing), `testVerifier()` for
  `createEngine({ auth })` in a test worker, and `mintTestToken`/`testBearer` for specs —
  tokens flow through the SAME jose verify path as production, only the JWKS is local.
  The `auth` config field is the one test seam; production configs never set it.

---

## 7. Push & bots

**FCM** — `notify/fcm.ts`, ported from `_engine/fcm.ts` but adapted off Deno +
`google-auth-library` to Workers-native **jose**: the engine signs the service-account
JWT (RS256) itself, exchanges it at Google's OAuth token endpoint, and caches the bearer
per isolate. Pushes target the FID as today. Turn/finish pushes are DO post-commit
effects delivered from the kernel's `notify_turn` / `notify_finished` effect plan (single
attempt + log; `notify/push.ts` owns the `device_installations` FID read and dead-device
prune); social pushes come from the worker's social routes. Configured by env convention
(`FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`) — absent ⇒ the
whole push step is skipped (best-effort, §8).

**Bot dispatch is driven by a registry `type`** (decided 2026-07-18; supersedes the
ported local/server split and the first-cut `is_local`/`webhook_url` inference). The
`bots` row carries `type ∈ {engine, external, local}` — a discriminated union enforced by
a DB CHECK (`external ⟺ webhook_url`) and narrowed to an exact TS union at the read
boundary (`narrowBot`). The DO reads the seated bot's row post-commit (off the hot path)
and routes on `type`.

*Engine bots run in the DO.* The rules are already TypeScript in the same bundle as the
DO, so the idiomatic home for a bot brain is an in-process function, not an HTTP hop: a
`GameRules` version unit ships **`botActions?: Record<username, (args) => action>`**,
keyed by **bot username** (the stable, human-readable registry field). When the kernel's
post-commit effect plan carries a `wake_bot` for an engine-bot seat, the DO resolves the
row's `username`, looks the function up in `botActions`, runs it, and self-applies the
move as the next serial command. Args are `{observation, botConfig, playerIndex, config,
rng}` — the bot is handed only its seat's fog-of-war **observation** (`plan.frames` for
its seat), never raw state, so it cannot cheat any more than a human at that seat;
`botConfig` is that row's own knob. Several bots that share behaviour point their
usernames at the same function and differ by `botConfig`; distinct behaviour is a distinct
entry. No webhook, no HMAC, no auth — the authority is talking to itself, and the
lost-wake window doesn't exist. It runs in `waitUntil` off the acting client's response,
so a bot that keeps the turn chains through the same effect dispatch (the kernel emits
`wake_bot` even for a bot actor re-entering pending — a bot has no live client);
commandId is deterministic so a double-dispatch dedupes. Two rules with reasons: brains
must be fast (tens of ms — the DO is single-threaded, and a long synchronous brain stalls
frame delivery for every socket on that game; heavy AI belongs in an external bot), and
there is **no pacing machinery in the DO** (the alarm stays deadline-only) — bot frames
arrive instantly and the client animates the thinking pause.

*External bots* (`type: external`) are hosted elsewhere (third parties, other languages,
heavy AI). The old server-bot contract, kept: woken post-commit with their observation
(HMAC-signed, `Eigen-Signature` header, single attempt), reply via the **`POST /api/bot/action`**
route. The API has two route groups under one `/api` prefix — the client engine group
(`/api/engine/*`, Firebase-authed) and the bot group (`/api/bot/*`, HMAC-authed) — as
**separate hono sub-apps mounted on one `/api` root**. Auth is per-sub-app middleware, so
the engine's Firebase check is scoped to `/api/engine/*` and never runs for `/api/bot/*`
(no shared `/api/*` middleware, no per-request path exemption). The bot self-authenticates
by HMAC (per-bot key = `HMAC(BOT_SIGNING_SECRET, bot_id)`, domain-tagged wake/action,
constant-time verify); the signature rides the **`Eigen-Signature` header** over the exact
request body — **the same header both directions** (wake and action), since the direction
is bound in the signed bytes, not the header name. A header signature is a representable
`apiKey` security scheme, so both groups surface in the one emitted OpenAPI doc, each with
its own scheme (`firebase` vs `botHmac`). The turn deadline
is the liveness backstop for a lost wake; `BOT_SIGNING_SECRET` unset ⇒ wakes are skipped.

*Local bots* (`type: local`) are client-driven and never dispatched server-side — a
registry row for identity only, reserved for the future offline-solo transcript import
(below). Seating one in an online game is rejected.

**Failure policy** is the standard one (single attempt + log), and **bots ⇒ timed**
survives as the one bot-liveness invariant (enforced for engine *and* external bots): a
thrown brain or an eviction mid-effect is backstopped by the turn deadline.

**Seating bots** — `add-bot` seats a bot into a waiting room; **create-solo**
(`POST /api/games/solo`) creates a private game seated with the caller plus bots and
starts it in one call (a guest's first-run experience, unrated). Both run the same gates
via one `assertBotSeatable` helper, switching on `type`: bots ⇒ timed, schema supported,
rated ⇒ `rated_eligible`; `engine` ⇒ a `botActions[username]` entry exists; `external` ⇒
a webhook (the CHECK guarantees it); `local` ⇒ rejected; and
`botSeatable(gameConfig, botConfig)`.

**Local bots are DELETED, not ported** (2026-07-18). They were a Supabase-era cost
optimization — every server-side bot move billed an EF invocation, while the client's
Dart twin ran the brain for free — and they were never offline: `local-bot-action`
posted every move and the observation pull was a server read. With in-DO brains the
advantage is gone and the costs remain (the Dart brain requirement, the isolate driver,
the sanctioned DO-read exception, three invariants). The invariants scoped to them
(local ⇒ sole human, 2+ humans ⇒ server, local ⇒ untimed) leave with them; what
survives is **rated ⇒ no guests + `rated_eligible`** and **bots ⇒ timed**, enforced at
the same two seams (worker policy + DO seating). Guests' bot access restates from
"local-bots-only" to "unrated only" — solo-vs-bot stays a guest's first-run experience.

**Future seam — offline solo (transcript import), designed, not built:** the *true*
fully-local experience local bots never were. The client simulates the whole game
on-device (Dart rules twin + Dart brain, seeded RNG — the twin-fixture drift suites are
exactly the contract that makes this safe), then uploads the seed + ordered action
transcript; the server replays it through the real TS rules in a DO — create-solo, then
each action as a normal serial command, legality-checked, illegal transcripts rejected
wholesale — so versions, frames, finish, compaction, and §4.6 replay come out identical
to an online game. Imported games are unrated, untimed, sole-human (the deleted local
invariants, resurrected scoped to imports, where they're honest: nobody was under a
server clock). Nothing in v1 forecloses this; nothing in v1 builds it.

---

## 8. Failure policy — start simple, keep the data

By decision, there is **no retry machinery** in v1:

| Effect | Policy | Backstop |
| --- | --- | --- |
| Bot turn | in-DO brain: 1 self-apply; external: 1 wake attempt, log | Turn deadline → timeout resolves the seat |
| D1 summary upsert | fire-and-forget (`waitUntil`), log | Re-derivable from the DO at any time |
| Finish: D1 apply | 1 attempt, log | **The outbox row is kept on failure** (DO storage is retained regardless — §4.6); gated admin re-poke re-runs the apply, idempotent via `finish_id` |
| FCM push | 1 attempt, log | Push is best-effort by nature |

The alarm is **deadline-only**: no multiplexer, no timers table, and *nothing else may call
`setAlarm`* — a stray call would silently unarm the turn deadline. If retry machinery is
ever added, it must go through a multiplexer; until then, this rule is enforced by
convention and review.

---

## 9. Client — Flutter, opinionated

Auth swaps to `firebase_auth`; the ~22 supabase-touching files collapse into
`eigen_client`'s generated API + hand-written frame stream. Everything downstream of the
transport — screens, providers, timing widgets, persistence, the Dart `GameModule`
contract — is untouched. The implementor still supplies three things: TS `GameRules`
(server truth), a `BoardView`, and an optional Dart twin for optimistic preview.

---

## 10. Cost — free tier from day 0

**We launch on the Workers free plan — with no payment method on file.** Every primitive
the day-0 design uses is on it: SQLite-backed DOs (the only kind we allow), alarms,
WebSocket hibernation, D1, and cron triggers (we use 1 of 5). R2 — the one primitive
that demands a card even for free use — is opt-in (avatars) or later (cold tier), and
its card requirement bites only on real buckets at deploy; local dev simulates R2 free
(§5.4). Zero design or code
differences vs paid — the free tier's
impact is purely operational: **daily hard caps that fail with errors** (reset 00:00 UTC)
instead of pay-as-you-go overage, and a 10 ms Worker CPU budget per invocation (DOs get
30 s on both plans; the one worker-side hot path, replay projection, is paginated — §4.6).

Assumes 2 seats, ~30 actions/game, commands over HTTP, frames over a **hibernating**
WebSocket. Per game: ~45 Worker requests, ~35 DO requests, ~0.2–0.6 GB-s DO duration
(post-commit effects keep the DO awake briefly), ~40 D1 row-writes, ~20–40 KB retained
in the DO after compaction.

| Free limit | Per game | Games/day |
| --- | --- | --- |
| DO — 100k rows written/day | ~70 *(one transition row + one command-dedupe row per action)* | **~1,400** ⟵ binds |
| Workers — 100k requests/day | ~45 | ~2,200 |
| DO — 100k requests/day | ~35 | ~2,850 |
| DO — 13,000 GB-s/day | ~0.2–0.6 *(hibernating)* | ~20k–65k |
| D1 — 100k rows written/day | ~40 | ~2,500 |
| DO SQLite — 5 GB stored *(account-wide)* | ~20–40 KB retained/finished game | ~125k–250k finished games before the cold-tier sweep is needed |

| | Free | Paid ($5 base) |
| --- | --- | --- |
| Capacity | ~1,400 games/day | **~15,000 games/day for ~$10/mo** |
| Idle cost | $0 | $5 |
| At the cap | operations **fail with errors** until 00:00 UTC | metered overage, no failures |

**What breaks at the cap, and why it's safe.** A spike that exhausts the DO row-write
budget makes commits fail loudly mid-game — ugly, but never corrupting: the kernel rejects,
nothing partial lands. A finish whose D1 apply fails on a cap leaves fully recoverable
state by design (§8: the outbox row survives until the apply succeeds, and DO storage is
retained regardless) and
the gated re-poke replays it idempotently after reset. The failure policy absorbs the
free-tier failure mode with no extra machinery.

**Upgrade trigger (ops rule, decided now):** move to paid at sustained **~900 games/day**
(≈ 60 % of the binding cap) **or on the first observed cap error** (Workers Error 1027 or
a DO/D1 storage-write failure) — whichever comes first. The dashboard's daily
rows-written/requests graphs are the meter; no in-app metering in v1.

For a whitelabel fleet this is per-app: N idle apps cost $0/month on free ($5N once
upgraded), vs N × $25/month on the legacy stack. Verified against Cloudflare pricing docs
2026-07 (including the Jan 2026 SQLite-storage billing change). One hard prerequisite, not
an optimization: **WebSocket Hibernation API from the first commit** (a non-hibernating DO
burns ~77 GB-s per 10-minute game — a 13× cost penalty, and ~6 games would exhaust the
free duration budget).

---

## 11. What CI must prove

- **Rules conformance** — the twin-fixture suite (same JSON format as today; TS runner moves
  from Deno to vitest, the Dart runner is unchanged).
- **Runtime conformance** — one scenario suite as JSON command arrays under
  `vitest-pool-workers` against local DO + D1: create, join (incl. last-seat race), leave,
  cancel, start, act, **simultaneous act** (the same-view accept case *and* the
  perturbed-view reject case), timeout, disconnect/resync, forfeit, finish, rate, replay
  (participant, viewer, hidden-info reveal), guest purge, avatar upload (opt-in route,
  against locally-simulated R2).
- **Hibernation assertion** — the DO holds no non-hibernatable state while idle (no
  `setTimeout`, no un-awaited fetches). The one bug that is expensive rather than wrong.
- **The leak test** — no response body ever carries an unprojected state field. *(v1:
  `server/test/leak.spec.ts` — drives a hidden-info game through create/join/start/action/
  finish/replay + the socket fan-out and asserts a state sentinel escapes through none of them.)*
- **Idempotency** — replaying any command or re-running the finish apply changes nothing.

---

## 12. Non-negotiables

1. **Hibernation from the first commit.**
2. **No network I/O between reading and writing DO storage** (§3.4).
3. **Never wake a DO for a read** (exception: live range fetch).
4. **One transition = one DO SQLite row.**
5. **The kernel stays pure** — no I/O, no platform imports, injected clock, forever.
6. **Commands are values**, pre-authorized, carrying a `commandId`.
7. **Every finish is idempotent**, keyed by `finish_id`; **the outbox row is cleared only
   after the D1 apply succeeds** — and DO storage is retained: it *is* the history (§4.6).
8. **Only the deadline path calls `setAlarm`.**
9. **Raw state never leaves the server** — replay projects on read; the retained DO
   history and the future `GAME_HISTORY` cold-tier bucket are server-only, never
   public (§5.4).
10. **The gated admin history/re-poke endpoint ships with the first game.**

---

## 13. What we gave up, with eyes open

| Loss | Mitigation |
| --- | --- |
| **The atomic finish** | The outbox + `finish_id` (§4.5); single-attempt policy backed by storage retention + admin re-poke |
| **RLS as defense-in-depth** | Kernel-level projection **plus** the leak test |
| **SQL-queryable game history** | The admin history endpoint (day one); ad-hoc analytics over live game data is genuinely gone |
| **Postgres expressiveness** (`int[]`, `pg_trgm`, interactive transactions) | JSON columns; `LIKE` (FTS5 later); `batch()` + CAS |
| **PostgREST's generated read API** | Hand-written Worker endpoints — the bulk of the build, producing no new capability |
| **Self-hostability** | Accepted — with a softer edge than first stated: `workerd` (Apache-2.0, the real Workers runtime) runs DOs single-node with disk persistence, so a fork can run the engine on one box at small scale (no distributed durability). The pure kernel keeps any bigger move a transport rewrite. |
| **Vendor risk** (DO billing already changed once, Jan 2026) | The pure kernel; the ~2-package host surface |

---

## 14. Build plan

| Phase | What | Exit criterion |
| --- | --- | --- |
| **0. Spike** (~1 wk) | Hibernating-socket echo game + deadline alarm + finish apply to D1, deployed for real + under vitest-pool-workers | Duration billing confirms hibernation; finish sequence survives forced eviction |
| **1. Kernel** | `@eigen/rules` + `@eigen/kernel`: port pipeline/observation/ratings/timing; same-view rule; grace constant; twin-fixture port | Kernel passes fixtures + timing/grace/same-view unit suites, zero infrastructure |
| **2. Runtime** | `@eigen/server` (do + routes + d1): commands, waiting room, sockets, reads, social, avatars (opt-in upload, local R2), cron, admin endpoints | RPS playable end-to-end under `wrangler dev` |
| **3. Conformance** | Full §11 suite | CI green on every non-negotiable |
| **4. Client** | `eigen_client` (generated API + frame stream) + `firebase_auth` swap + transport rewrite in `eigen_flutter`; RPS Flutter app against a deployed env | Full game on a phone against production CF |
| **5. Cutover** | Bravado starts on `@eigen/*`; delete `supabase/`; archive the Supabase project | Bravado development proceeds on CF only |

> **Phase 0 folded into Phase 2** (decided 2026-07-16, after Phase 1 shipped
> first): no throwaway echo worker — Phase 2's first milestone built the real
> `GameDO` skeleton under vitest-pool-workers. The spike's two deploy-only
> exit criteria (hibernation duration billing, finish-sequence survival
> across eviction) briefly lived in a manual `docs/deploy_runbook.md` against
> a temporary dev harness; both were RETIRED 2026-07-17 (user call: no manual
> testing) when `createEngine` landed and the harness + runbook were deleted —
> the deploy-only checks fold into the Phase 4 "full game on a phone against
> production CF" criterion instead.

---

## 15. Repo setup instructions (CLI-first, one-time)

**The split**: CLI-generate anything that encodes *platform* knowledge (versions, config
formats, compatibility dates) — that's where written-down snippets go stale. Hand-write
anything that encodes *our* architecture (package boundaries, schemas, exports) — no
scaffolder knows it. **When a snippet in this section disagrees with what a CLI emits,
the CLI wins and this doc gets updated.** `pnpm wrangler --help` and the `create-cloudflare`
prompts are ground truth for anything post-snippet.

### Step 0 — Prerequisites

```bash
node --version        # Node 24 (current LTS; anything ≥ the active LTS is fine)
pnpm --version        # pnpm 11.x — pinned by devEngines in root package.json
# Cloudflare account at dash.cloudflare.com (free plan — upgrade per §10 trigger)
```

Wrangler is a repo devDependency run via `pnpm wrangler` — never installed globally, so the
version is pinned per project.

### Step 1 — Root workspace (hand-written; no CLI owns this shape)

```bash
mkdir eigen-server && cd eigen-server && git init
```

Root files: `package.json` (`pnpm init`, then edit: `"private": true`, `"type":
"module"`, `devEngines.packageManager` pinning pnpm 11.x with `"onFail": "download"` —
the modern replacement for the corepack `packageManager` field — and `pnpm -r` fan-out
scripts) · `pnpm-workspace.yaml` (`packages/*`, `examples/*`, plus `allowBuilds` for
`esbuild`/`workerd`/`sharp` — pnpm 11 blocks postinstall build scripts by default and
workerd's binary needs one) · `tsconfig.base.json` (strict, `target ES2024`,
`moduleResolution Bundler`, `declaration` + `declarationMap` for the library packages) ·
`.gitignore` (`node_modules`, `dist`, `.wrangler`, `.dev.vars`) · `.nvmrc` (`24`). These
formats are stable and boring; nothing to learn from a generator.

### Step 2 — `examples/rps` via create-cloudflare (the learning centerpiece)

```bash
pnpm create cloudflare@latest examples/rps
# prompts: Hello World → Worker + Durable Objects + Assets → TypeScript → no git → no deploy
```

Read every file it emits before touching anything: `wrangler.jsonc` is the current config
format with a current `compatibility_date` and today's DO-binding + class-lifecycle
syntax; `src/index.ts` is the canonical worker-exports-DO-class shape (the fact that made
`server` one package). Where C3's output differs from this doc's snippets, C3 is right —
with one known exception: the template still emits the **legacy `migrations` array** for
the DO class, which CF has replaced with the declarative **`exports` field** (see the
target shape below). Both work, but a worker uses one or the other and can't move from
`exports` back to `migrations` — adopt `exports` before first deploy.

As built (2026-07-16), the template also emitted, all keepers: `$schema` pointing at
wrangler's config schema, `observability: { enabled: true }`, `upload_source_maps: true`,
and a `cf-typegen` script (`wrangler types` → `worker-configuration.d.ts`, referenced
from the app tsconfig's `types` — this replaces the legacy `@cloudflare/workers-types`
package). It shipped **no test setup**, so the `vitest-pool-workers` wiring is hand-added
from its current docs (step 6). It also shipped a `.prettierrc` — delete it when biome
lands (step 7).

C3 runs an install inside the new directory, leaving a nested `pnpm-lock.yaml` +
`node_modules` there. Delete both and run `pnpm install` from the root: the workspace
keeps **one lockfile at the root** (pnpm's default — single resolution universe, required
for `workspace:*` links; per-package lockfiles are only for independently-installed
deploy units, which `wrangler deploy` bundling never needs).

Then edit the generated `wrangler.jsonc` **toward this target shape** (diff, don't
replace):

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "rps",
  "main": "src/index.ts",
  "compatibility_date": "<keep C3's>",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true },
  "upload_source_maps": true,
  "durable_objects": { "bindings": [{ "name": "GAME_DO", "class_name": "GameDO" }] },
  // Class lifecycle — replaces the legacy migrations array C3 still emits. Declarative:
  // this states what the class IS (SQLite-backed — free-tier-compatible, one-row
  // transitions), not a history of steps. Renames later: state: "renamed" + renamed_to.
  // Renaming MyDurableObject → GameDO in place is fine while nothing is deployed:
  "exports": { "GameDO": { "type": "durable-object", "storage": "sqlite" } },
  "d1_databases": [ /* paste the block `d1 create` prints (step 3) */ ],
  // R2 (§5.4): AVATARS ships in v1 as opt-in and the example exercises it. The binding
  // works fully under local simulation (wrangler dev / tests) with no card and no real
  // bucket; creating the real bucket for a deploy with uploads enabled is the moment a
  // payment method enters — comment this out to deploy card-free. GAME_HISTORY (cold
  // tier) comes later, with paid.
  "r2_buckets": [{ "binding": "AVATARS", "bucket_name": "eigen-avatars-dev" }],
  "triggers": { "crons": ["0 3 * * *"] },   // guest purge
  // §2.4 — static assets unmetered; only these paths invoke the worker.
  // `run_worker_first` DEFERRED (2026-07-16): assets only serve exact file
  // matches and everything else falls through to the worker, so it's needed
  // only once public/ contains files that could shadow worker routes — add
  // ["/api/*", "/.well-known/*", "/j/*"] then.
  "assets": {
    "directory": "./public/"
  }
}
```

The `"storage": "sqlite"` declaration is load-bearing (though now also mandatory for new
classes — legacy KV storage is closed to new namespaces). The `bindings` entry stays: it
grants the worker `env` access; `exports` governs the class's lifecycle.

### Step 3 — Cloudflare resources (CLI by definition)

```bash
pnpm wrangler login && pnpm wrangler whoami
pnpm wrangler d1 create eigen-dev     # prints the d1_databases binding block — paste it
```

No `r2 bucket create` day 0 (§5.4) — real buckets demand a payment method. The AVATARS
binding still works under `wrangler dev` and in tests (local simulation); the bucket is
created only when deploying with uploads enabled.

### Step 4 — First contact with the dev loop

```bash
cd examples/rps && pnpm wrangler dev   # one process: worker + DO + D1 + simulated R2
```

Curl the hello-world route, then skim `.wrangler/state/` — that's where local D1/DO
state lives, and deleting it is what "reset local state" means in the dev-phase
edit-migrations-in-place convention. (`wrangler dev` replaces the whole Supabase Docker
stack.)

### Step 5 — Package stubs (hand-written; pure our-architecture)

```bash
mkdir -p packages/{rules,kernel,server,testkit}
```

Each gets `pnpm init`, then edit: `"name": "@eigen/<pkg>"`, `"type": "module"`,
`exports` → `dist/`; internal deps use `"workspace:*"`.

### Step 6 — Dependencies

```bash
pnpm add -Dw typescript wrangler \
  vitest @cloudflare/vitest-pool-workers tsup @changesets/cli @biomejs/biome

pnpm --filter @eigen/rules   add @standard-schema/spec
pnpm --filter @eigen/kernel  add openskill rand-seed
pnpm --filter @eigen/server  add hono @hono/zod-openapi zod jose drizzle-orm
pnpm --filter @eigen/server  add -D drizzle-kit
```

No `@cloudflare/workers-types` — legacy; runtime types come from `wrangler types`
(the `cf-typegen` script → `worker-configuration.d.ts`). How `@eigen/server` (a library
with no worker of its own) gets its types is a Phase 2 decision: a minimal types-only
wrangler config run through `wrangler types`, or referencing the example's generated
file in dev.

⚠️ `@cloudflare/vitest-pool-workers` pins a narrow vitest version range, and the C3
template shipped no tests to copy from — wire it from its current docs, don't take
latest vitest blindly.

| Tool | Role |
| --- | --- |
| `wrangler` | Local dev, migrations, secrets, deploys |
| `vitest-pool-workers` | Tests run *inside* workerd against real DO + local D1 |
| `tsup` | Builds `dist/` (ESM + d.ts) for private npm publishing |
| `changesets` | `@eigen/*` versioning (use when Bravado consumes) |
| `biome` | Lint + format |

### Step 7 — Tool configs (own `init` where one exists)

`pnpm biome init` (emits current-format `biome.json`; delete C3's `.prettierrc` from
`examples/rps` at the same time — one formatter). Drizzle-kit has **no** init:
`@eigen/server`'s **two drizzle-kit configs** are hand-written (~8 lines each) — one for
D1 (`dialect: 'sqlite'`, `out: './migrations'` — generate only, shipped with the package
and applied by the app's `deploy` script via `wrangler d1 migrations apply`, identical
against local and remote; §5.2) and one for the DO
(`dialect: 'sqlite'`, `driver: 'durable-sqlite'`, out under `src/do/` — emits a
`migrations.js` bundle the worker imports; §5.1). They must not share an `out` directory.
Both are engine-development tools — implementor apps carry no drizzle config at all.

### Secrets

Local: `examples/rps/.dev.vars` (gitignored) — `FIREBASE_PROJECT_ID` (token verify),
`FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` (FCM + account deletion only),
`BOT_SIGNING_SECRET`. Production: `pnpm wrangler secret put <NAME>` per environment.

### Verify

```bash
cd examples/rps && pnpm wrangler dev    # hello-world serves
pnpm vitest                              # if the C3 template shipped tests
```

Deferred until needed: GitHub Packages `.npmrc` + publish workflow (when Bravado consumes
`@eigen/*`), `pnpm changeset init`, CI workflow (written alongside the first tests),
Firebase console provider enablement (client phase).

---

## Appendix — rejected alternatives (kept for the next time they're proposed)

**The principle underneath most of them: the outbox is contagious, and its benefits are
not.** Free serialization, a database-free hot path, and per-entity storage that migrates
itself accrue only to a durable per-entity store — i.e., to Durable Objects.

- **Dual-host (Node + Cloudflare), Postgres as system of record** — preserves the atomic
  finish and self-hosting; costs 5–10× the money, doubled CI, and a permanent
  design-to-the-intersection tax. *Flips if* a studio/data-residency customer must run on
  their own infra.
- **DO as coordinator, Postgres as store** — pays the Postgres round trip *and* forfeits
  free serialization (the input gate doesn't cover network I/O): worst of both.
- **Node with in-memory state** — a deploy evaporates live games and corrupts the
  append-only frame contract. **Node with local SQLite** — converts stateless replicas into
  a hand-rolled stateful sharded cluster; that's the problem DOs exist to solve.
- **Firestore as global store** — client-direct reads would delete much of the read API,
  but per-action summary writes cost $8–11/mo at 5k games/day (D1: $0) and the free tier
  caps ~600 games/day; no joins, no substring search. *Flips if* the dashboard stops
  needing per-action freshness.
- **`firebase-auth-cloudflare-workers`** — unofficial, low adoption; `jose` + our claim
  checks instead.
- **Workers KV** — eventually consistent (~60 s propagation), so wrong for anything
  authoritative, and everything staleness-tolerant we have is already covered: config is
  wrangler vars/secrets, small registries are cheap D1 reads, JWKS is cached in-isolate by
  `jose` (Cache API if it ever matters). No niche left between DO (strong consistency),
  D1 (global reads), and R2 (blobs). Reconsidered 2026-07-16 as a card-free game-history
  store (R2 demands a payment method even for free use): rejected again — KV's design
  center is edge-cached *hot* reads, the opposite of cold write-once replay blobs (no
  cache benefit on cold keys, ~60 s visibility gap after finish, 1k writes/day would
  become the finished-game binder, 1 GB storage). Retaining history in the DO (§4.6) is
  both simpler and stronger.
- **Queues / Workflows** (both free-plan-available) — every async spot is already covered:
  effects are declaredly best-effort (§8), and the one must-not-lose job (finish apply) is
  durable via DO storage retention + `finish_id` re-poke — a one-slot queue colocated with
  its state. Adding Queues re-adds the deleted retry machinery and, on free, its 10k ops/day
  would become the capacity binder. Queueing the finish (the ratings/D1 apply) specifically was
  considered and rejected: the enqueue itself can fail (so retained-storage survives, just
  rescoped), and free-tier
  24 h retention (DLQ included) would silently expire the one must-never-lose job that today
  is loudly recoverable forever. *Flips if* partially-deleted accounts appear (→ wrap
  account deletion, the system's only multi-step saga, in a Workflow), FCM batching is
  needed at scale, or — on paid, with its 14-day retention — finish-apply re-pokes become
  recurring toil (→ queue the small D1-apply step only, with a DLQ alert).
- **D1 as the game-history store** — hard 10 GB/database ceiling (~1 month of history
  objects at target scale) and 2 MB row cap; the history lives in each game's DO (§4.6),
  cold-tiered to unbounded R2 later.
- **R2 history write at finish** (the original design) — architecturally sound (inert,
  enumerable, frozen system-of-record blob) but demoted to the *cold tier* (§4.6):
  R2 requires a payment method even for free-tier use, breaking the no-card day-0 story,
  and retention-in-the-DO deletes the copy step plus its whole failure branch. The blob
  design returns verbatim as the age-based sweep once on paid.
- **Convex** — genuine ACID + TS-native reactivity, but no first-class Dart client and an
  awkward fit for per-seat hidden-info fan-out. Recorded because it's the strongest
  outside candidate.
- **Nakama as the base** — ships lobby/friends/leaderboards, but always-on Go + Postgres
  contradicts scale-to-zero, and the hidden-info-first frame model would be bolted on.
