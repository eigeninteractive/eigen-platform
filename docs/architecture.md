# Eigen Server — Architecture

Eigen is a **whitelabel, server-authoritative, turn-based multiplayer game
engine**. One codebase runs many games (Rock-Paper-Scissors, Bravado, …); each
deployment is a single Cloudflare Worker that owns its own domain, database, and
players. This document describes how the server is built and how it behaves,
end to end. It is the reference for the people maintaining the engine and for
implementors integrating a game against it.

Its companion, [`building_a_game.md`](./building_a_game.md), is the guide for
writing a game **on** the engine. This document is about the engine **itself**.

---

## 1. What the engine is

An Eigen game is a sequence of **versioned, server-authoritative transitions**.
The server — never the client — decides what each move does, whose turn it is,
what each player is allowed to see, when a clock expires, and how a finished
game is rated. Clients render state and submit intents; they hold no authority.

The design centre is a single principle: **each game is one serialized state
machine with one owner.** That owner is a Cloudflare Durable Object (DO). One DO
per game, addressed by the game's id, is the authoritative session *and* the
game's permanent history. Everything else — the API, the global database, push,
avatars — orbits that.

Three properties fall out of this and shape the whole system:

- **Server authority.** The rules run on the server. A client's move is a
  *proposal*; the DO validates it against the true state and either commits it
  as the next version or rejects it. Hidden information never leaves the DO
  except as a per-seat projection.
- **Strong per-game consistency.** A DO processes its commands one at a time
  under an input gate. There are no lost updates, no torn writes, no
  distributed-lock dance — the platform serializes access to each game for us.
- **Determinism & replayability.** State is a pure function of `(base seed,
  ordered action log)`. The action log is append-only and immutable; replaying
  it reproduces the game exactly. This is what makes history, reconnection, and
  the client's optimistic preview all sound.

### Non-goals

The engine is not a real-time (sub-second, physics) engine, not a lobby
matchmaker with skill-based queues (games are created and shared, or played vs
bots), and not a general document store. It is tuned for **turn-based games
where correctness and fair timing matter more than raw throughput.**

---

## 2. The platform, and why each piece

Everything runs on Cloudflare's developer platform. The inventory is
deliberately small, and the required day-0 path uses **only free-tier services
with no payment method**.

| Concern | Service | Role |
|---|---|---|
| API + web host | **Workers** (hono + `@hono/zod-openapi`) | Stateless request handling, auth, policy, routing; also serves the app-link files and share pages |
| Authoritative game session | **Durable Objects** (SQLite-backed) | One per game — live and finished. The serialized state machine and the permanent per-game history |
| Global cross-game store | **D1** (SQLite) | Identity, social, bots, ratings, and game *summaries* — a read-model + registry, never an arbiter |
| Avatars (opt-in) | **R2** | User-uploaded avatar objects; developed under local simulation, a real bucket only at deploy |
| Auth | **Firebase Auth**, verified in-worker with **jose** | Google / Apple / Anonymous sign-in; the worker verifies ID tokens itself |
| Push (opt-in) | **FCM HTTP v1** | Turn / finish notifications |

Why these and not the obvious alternatives:

- **Durable Objects, not a shared SQL row + locks.** The classic
  turn-based-game bug is two writers racing on one game row (two finishes, two
  moves at the same version). A DO makes that structurally impossible: the
  platform routes every request for a given game id to the same single-threaded
  object, and its input gate serializes them. The old lost-update bugs simply
  cannot be expressed.
- **DO SQLite is also the history store.** A finished game's DO keeps its
  transition log forever. There is no separate "archive write at finish" — the
  DO *is* the archive. Replaying a game years later just wakes its DO. (A
  future cold tier can sweep very old games to R2; §9.)
- **D1 is a read-model, never the source of truth for live play.** Lobbies,
  "my games", leaderboards, and profiles read D1. It is updated *from* DO
  effects after a command commits, and it is allowed to be briefly stale
  (a lobby may show a game that just filled). It never arbitrates a move.
- **KV is intentionally absent.** Its design centre is edge-cached hot reads —
  the opposite of authoritative serialized writes (that's the DO) and
  write-once cold history (that's DO SQLite / R2).
- **jose, not a Firebase SDK.** Verifying a Firebase ID token is ~40 lines of
  standard JWT verification against Google's JWKS. jose is a maintained,
  platform-native library; the engine keeps the whole auth surface in view.

### Cost & scaling posture

The free-tier binder is DO SQLite + D1. The first ceiling is DO storage writes
(~100k rows/day ≈ ~1,400 games/day). Crossing it is a one-click plan upgrade
with **zero code change** — no architecture in this document assumes the paid
tier. R2 (avatars) and FCM (push) are opt-in and add a payment method only when
an operator turns them on for a real deploy.

---

## 3. Shape of the system

### 3.1 Four packages

The server is a small pnpm monorepo. The split is by **trust and purity**, not
by feature:

```
@eigen/rules    The implementor contract: GameRules, GameModule, the six hooks,
                the JSON/Envelope/Observation types. Pure types + 2 helpers.
                Zero engine dependencies — a game author reads only this.

@eigen/kernel   The pure decision core. Given (game, state, roster, intent, now)
                it returns a commit plan or a rejection. No I/O, no platform
                APIs, fully unit-testable. Owns timing/grace, the same-view rule,
                observation fan-out, RNG derivation, and the rating math.

@eigen/server   Everything that deploys: the BaseGameDO class, the hono routes,
                the D1 schema + appliers, auth, bots, push, the createEngine
                factory. This is the only package an implementor's Worker imports
                at runtime (plus their own @eigen/rules game module).

@eigen/testkit  Shared conformance fixtures + kernel scenarios, run by both the
                TS tests and the Dart client's tests to catch twin drift.
```

An implementor authors a game against `@eigen/rules`, and ships a Worker that
imports `@eigen/server`. They never see the DO internals, the D1 schema, or the
migration machinery.

### 3.2 One Worker, two authenticated API groups, one public web surface

`createEngine(config)` returns a single Worker (`{ fetch, scheduled }`). Its
request surface is three cleanly separated spaces on one host:

```
/api/engine/*   Client API. Every route requires a verified Firebase ID token.
                Games, waiting room, actions, reads, profile, avatar upload,
                device registration, account deletion, the game socket.

/api/bot/*      External-bot webhook. Authenticated per-request by an HMAC
                signature (no user token). Just POST /api/bot/action today.

/ (public)      Unauthed web surface, mounted only when configured:
                /.well-known/assetlinks.json + apple-app-site-association
                (deep-link verification), /j/:shortCode (share/landing page),
                /avatars/:uid (opt-in avatar serving). Plus static assets.
```

The two API groups are **separate hono sub-apps** so their auth never mixes: the
engine group's Firebase middleware is scoped to `/api/engine/*` and never runs
for a bot or a public request. Both groups emit into one OpenAPI document (each
with its own security scheme), which is generated here and vendored into the
Dart client repo for codegen.

Static assets are served **unmetered** by Cloudflare's asset server. A request
that matches no static file falls through to the Worker on its own, so the
dynamic paths need no `run_worker_first` configuration — the only rule is not to
place a `public/` file that shadows one of them.

### 3.3 The path of a move

A single action shows how the pieces interact:

```
client ──POST /api/engine/games/{id}/action { seat, expected_version, data }──►
  Worker: verify Firebase token → provision/load user row → build a Command
          (a pre-authenticated value) → call the game's DO stub
    DO (input gate held):
      dedupe on commandId (replay stored response if seen)
      load meta + roster + latest transition from its SQLite
      verify the seat belongs to the caller  (else a clean 403)
      run the KERNEL: validate move, apply the game hook, compute timing,
                      project per-seat observations, decide finish
      if rejected → return the rejection as a value
      else → ONE SQLite transaction: append the transition (next version),
             write per-seat frames, store the command response, arm/clear alarm
      post-commit (gate released): fan out frames over sockets, mirror the
             summary to D1, run bot turns / pushes / finish apply
  ◄── the caller's own committed frame rides the HTTP response
  ◄── every other seat's frame arrives over its WebSocket
```

The critical discipline: between reading storage and writing it, the DO does
**no non-storage `await`**. The read → pure-kernel-decision → single
synchronous SQLite transaction runs entirely under the input gate, so no other
command can interleave. Every network effect (socket fan-out, D1 writes, bot
wakes) happens *after* the commit, where interleaving is harmless.

---

## 4. The kernel — the pure decision core

`@eigen/kernel` is the crown jewel: a pure function from inputs to a commit plan.
It touches no platform API, so it is exhaustively unit-testable and identical in
every environment.

```
commit({ game, state, roster, intent, now, rules, staleViews }) →
    CommitPlan  |  Rejected
```

- **`intent`** is one of `start` (seed a new game), `action` (a player/bot
  move), or `lifecycle` (`timeout` / `forfeit` / `auto_forfeit`).
- **`rules`** is the game's `GameRules` unit for this game's `schema_version`.
  The kernel invokes the game's hooks but owns everything around them.
- A **`CommitPlan`** carries: the next `StateRow` (version, opaque state,
  pending set, deadline, per-player clocks), the per-seat projected
  `frames`, the `action` to log, any `outcomes` (if the game ended), the
  `alarm` time to arm, and named **effects** (`wake_bot`, `notify_turn`,
  `notify_finished`) for the runtime to deliver post-commit.
- A **`Rejected`** is a value, not an exception: a stable `code`
  (`illegal_move`, `not_participant`, `board_updated`, …) plus a message. The
  DO returns it; the Worker maps it to an HTTP status.

The kernel owns four things worth calling out:

- **Timing & grace** (§6): computing the next deadline, the per-player time
  bank, and whether a late submission is still inside the grace window.
- **The same-view rule** (§7): whether a stale-version action is still valid.
- **Observation fan-out**: calling `computeObservation` once per seat to build
  the frames, and enforcing that a seat's projection stays truthful about
  itself.
- **Rating math**: OpenSkill posteriors, given priors and placements. (The
  *application* of ratings — reading priors, the CAS write — is in the DO/D1
  layer, §8; only the math is here.)

Version dispatch never happens *inside* game logic. The engine resolves the
game's `schema_version` to a `GameRules` unit once, up front, and every hook it
calls is already the right version. A game author never writes `if (version ===
…)`.

---

## 5. The game session — one Durable Object per game

`BaseGameDO` is the abstract base an implementor subclasses. Each instance is
one game, addressed deterministically by `idFromName(gameId)`.

### 5.1 The per-game SQLite schema

The DO's own SQLite database is the game. Six tables:

| Table | Lifetime | Purpose |
|---|---|---|
| `meta` | permanent | The single game row (id, status, access, schema_version, config, timing, rated, pool, roster bounds, creator, rng seed). Copied once from D1 at lazy-init, then DO-owned. |
| `roster` | permanent | One row per seat (`player_index`, `user_id`/`bot_id`, `type`). The **authoritative** roster — D1's copy is a display mirror. |
| `transitions` | permanent | **Append-only, immutable.** One row per version: the opaque `state`, the `action` that produced it, the pending set, deadline, per-player clocks. This table *is* the game's history. |
| `frames` | live-only | Per-seat projected observations, for socket gap-recovery and the same-view compare. Drained by the finish compaction (replay re-projects instead). |
| `commands` | live-only | `commandId → stored response` for idempotent retries. Drained by the finish compaction. |
| `outbox` | transient | What the D1 finish-apply needs, written atomically with the finishing transition and cleared only *after* the apply succeeds. Its presence is the recovery signal. |

The schema is engine-owned and self-applying: a drizzle `durable-sqlite`
migration bundle is compiled into the Worker and runs inside
`blockConcurrencyWhile` on first activation — so even a finished game woken years
later migrates itself before serving anything.

### 5.2 Lazy initialization

A game's D1 row is written *before* its DO exists (creation is a direct Worker →
D1 write; §5.3 of the lifecycle). The DO is created lazily on first contact
(first command or socket): it reads the game + participants from D1 once, inside
`blockConcurrencyWhile`, and copies them into `meta` + `roster`. From then on the
DO owns `status` and `rng_seed`; D1's copy becomes a display read-model updated
from DO effects. If no game row exists in D1, first contact resolves to a clean
`unknown_game`.

### 5.3 The command pipeline & idempotency

Every command that crosses the Worker → DO boundary is a **self-contained,
pre-authenticated value** (`Command`): the kind, the game id, a `commandId`, the
acting `Principal` (a user id *or* a bot id, never both), and the payload. The
Worker has already verified the token and run every *policy* check before minting
it; the DO enforces *integrity* (seat occupancy, status, versions) under its
gate. This clean split — policy at the edge, integrity in the DO — means a
command is loggable, replayable, and a CI fixture is just a JSON array of them.

Two idempotency keys keep the pipeline exactly-once:

- **`commandId`** (client → DO): the DO stores each accepted command's response
  and replays it verbatim for a duplicate, so a client retry never double-applies
  a move. (Rejections are recomputed fresh — re-evaluating one is always sound.)
- **`finish_id`** (DO → D1): the finishing transition mints one; the D1 apply is
  a no-op if the games row already carries it, so a re-poked finish is safe.

Serialization orders commands but cannot *identify* duplicates — that is what the
ids are for.

### 5.4 Versions are strictly serial

Every accepted command commits as the next integer version, in arrival order, with
**no gaps, ever**. The same-view rule (§7) governs *acceptance* only; it never
reorders or skips versions. This invariant is what lets the client recover any
gap by a simple version-range fetch and lets replay walk the log linearly.

---

## 6. The game lifecycle, end to end

### 6.1 Creation — the one Worker-direct write

`POST /api/engine/games` is the single place the Worker writes game state to D1
directly, because the DO does not exist yet. The Worker runs all creation policy
(guest gates, config parse against the version schema, the `ratingPool`
decision, and validation of the client's concrete `rated` assertion), generates
a unique `short_code` (a readable 6-char code with a retry loop on the UNIQUE
index), and writes the games + participants rows with the creator in seat 0.
The DO is not touched; it will lazy-init on first command or socket.

`rated` is a **validated assertion**, never a coercion: the client computes it
too (via the Dart twin of `ratingPool`), and a mismatch is rejected rather than
silently "corrected" — that catches twin drift and forged clients.

### 6.2 The waiting room

Before a game starts, the roster is mutable. Join / leave / cancel / add-bot /
start are **Commands to the DO**, with policy checked at the Worker *before*
minting (guest-vs-rated, friends-access, schema gate — no D1 reads inside the
gate) and integrity enforced in the DO (status, seat occupancy, creator-only
rules). Highlights:

- **Join** by id or by short_code. Creating with `min_players` already satisfied
  makes a game `ready`; otherwise `waiting`.
- **Leave** compacts seat indexes (safe pre-start, since no transition references
  a seat yet). The creator cannot leave — they cancel.
- **Add-bot** is creator-only and passes the §11 seating gates.
- **Cancel** is creator-only, drops the DO's storage, and marks the D1 row
  `aborted` (the D1 write is *awaited* here, unlike other lobby effects, because
  the aborted row is the only survivor).
- **Start** is creator-only, commits version 0 via the kernel, and arms the
  first deadline.

The client opens its WebSocket *before* start. Pre-game, the DO pushes
unversioned, idempotent **roster snapshots** on every change (a reconnect just
gets the current one); versioned frames begin at v0. D1's participants copy is
updated post-commit and is allowed to be briefly stale — a stale lobby just means
a join can fail cleanly at the DO.

**create-solo** (`POST /api/engine/games/solo`) collapses "create a private game
seated with me + bots, and start it" into one call, returning the caller's
opening v0 frame so the client can render immediately. Guests may play bots
(unrated).

### 6.3 Active play

A move is `POST /api/engine/games/{id}/action` carrying the caller's own `seat`,
the `expected_version` it computed against, and the game-defined `data`. The DO
verifies the seat belongs to the caller against its authoritative roster (a seat
you don't hold is a clean 403), runs the kernel, and — on accept — commits the
next version and rides the caller's own projected frame back on the response.
Every other seat's frame arrives over its socket. Forfeit is the same shape with
a `lifecycle`/`forfeit` intent.

Humans and bots submit a seat **uniformly**; the DO resolves the actor (user id
from the token, bot id from the HMAC claim) against the roster the same way for
both. There is no server-side "figure out my seat" fallback.

### 6.4 Finish, and history compaction

When a hook returns an `outcome`, the finishing transition commits `status =
finished` and writes an `outbox` row *in the same SQLite transaction*. Then,
post-commit and off the response path:

1. **The D1 finish-apply** writes the game summary + outcomes, and (for rated
   games) runs the rating CAS (§8). It is idempotent via `finish_id`.
2. On success, a final **ratings transition** (version N+1) is appended for
   rated games — carrying each seat's rating delta — and **the compaction rides
   the outbox clear**: one SQLite transaction empties the live-only `frames` and
   `commands` tables and deletes the `outbox` row. ~20–40 KB of permanent
   `transitions` + `meta` + `roster` remain.

The outbox row is the recovery signal: if the D1 apply fails, it survives, and a
gated admin re-poke re-runs the apply (idempotent). DO storage is **never**
dropped at finish — only at cancel/abort. The finished DO *is* the game's
history.

### 6.5 Cancel & abort

Cancel (creator, pre-start) and abort (the cron reap of abandoned games, §14)
mark the D1 row `aborted` and drop the DO's storage entirely — there is no
history object for a game that never really happened. Abort is unconditional (no
creator gate, works even on a never-initialized DO).

---

## 7. Timing & the deadline alarm

Timing is server-authoritative and lives in the kernel. A game is created in
exactly one timing mode:

- **Turn**: a fixed budget per move (`turn_seconds`).
- **Budget** (chess-clock): a per-player bank (`budget_seconds`) with an optional
  Fischer `increment_seconds` added after each move.
- **Untimed**: no clock at all.

(Turn and budget are mutually exclusive; increment requires budget.) A hook may
also override the deadline for a single action via the envelope's `turn_seconds`,
without touching any player's bank.

### The deadline computation

After every transition the kernel computes the next `deadline` and
`turnStartedAt` by a fixed precedence chain (all instants are injected epoch
milliseconds — the kernel never reads a clock):

1. **Game over** → both `null` (no deadline).
2. **Hook per-action override** (`envelope.turn_seconds = N`) → `now + N·1000`,
   banks untouched.
3. **Budget mode** → `now + min(remaining bank over the new pending seats)`. A
   budget-timed game allows at most one pending seat (enforced upstream), so this
   min is normally just that seat's bank; the min is a safe degradation if a
   multi-pending state ever arrives.
4. **Per-turn mode** → `now + turn_seconds·1000`.
5. **Untimed** → both `null`.

In budget mode the acting seat's bank is charged on each move:
`bank[seat] = max(0, bank[seat] − (now − turnStartedAt)) + increment·1000`.
The deduction floors at 0 (an overrun lands at 0, never negative), and the
Fischer increment is added after.

### Grace, and why it's a single constant

The enforcement mechanism is the **DO's durable alarm**, and this is a key
simplification over a database-backed engine. Server time is measured when the
request *arrives*, not when the player tapped, so a move made on time can land
just past the deadline through pure network latency. One grace constant in the
kernel (`DEADLINE_GRACE_MS = 750ms`) compensates, with exactly two call sites: the
kernel accepts an action while `now ≤ deadline + grace`, and the DO arms its alarm
at `deadline + grace`. Whichever arrives first — the latent action or the alarm —
commits; the loser sees already-advanced state and no-ops. When the alarm fires it
commits a `timeout` lifecycle with a deterministic `commandId` (so a double-fire
dedupes, and a real move that arrived first simply wins).

The grace forgives **acceptance, not time charged**: in budget mode the elapsed
deduction still runs, so flag-fall is honoured — a player whose bank hits 0 can
overrun by at most the grace and still have that final move counted (bounded and
self-limiting). This replaced an older three-place race symmetry with one
constant.

Because the alarm is a durable, per-game, platform-retried timer, **there is no
timeout-sweep cron.** A database-backed engine needs a periodic scan for overdue
turns because the database has no per-row timer; the DO alarm *is* that timer, so
the sweep evaporates. The deadline alarm is the *only* code that sets an alarm on
the DO — a stray `setAlarm` elsewhere would silently disarm a turn deadline.

Untimed games have no alarm at all; their only backstop is the abandoned-game
reap (§14).

---

## 8. Data & storage

### 8.1 Two stores, two jobs

- **DO SQLite** (per game) is *integrity + history*: the authoritative roster and
  the immutable transition log. Never read to serve a list.
- **D1** (global) is a *read-model + registry*: identity, social, bots, ratings,
  and game **summaries**. Never wake a DO to serve a read — lobbies, "my games",
  profiles, and leaderboards all read D1.

A game's summary row is created Worker-direct, then updated from DO effects after
each commit (accepted staleness). A summary carries dashboard hints (status,
whose turn, the deadline, final outcomes) but **never game state** — raw state
lives only in the DO.

### 8.2 The D1 schema

| Table | Purpose |
|---|---|
| `users` | Identity, keyed by Firebase uid (stable across guest→permanent upgrade). Merged users + profile. `avatar_url` defaults to the provider photo. |
| `games` | The summary/read-model row (timing, rated, pool, status, outcomes, short_code, `finish_id`, `finished_at`, a nullable `archived_at` cold-tier seam). |
| `participants` | The roster join table — one row per seat, the indexed access path for "games of user X". A display mirror of the DO roster. |
| `relationships` | Friend edges in canonical pair order (the social milestone consumes these). |
| `bots` | The bot registry (§11): `type` ∈ engine/external/local, `webhook_url` for external, capabilities `config`. CHECK-enforced. |
| `player_ratings` | Per-identity per-pool OpenSkill rating + a `revision` CAS counter. |
| `rating_history` | Immutable per-game rating log, unique per (game, identity), carrying `finish_id`. |
| `device_installations` | FCM push targets keyed by Firebase Installation ID (FID). |

D1 has **no foreign-key cascades**: relationships between tables are maintained
explicitly (e.g. account deletion is an explicit preserve-vs-delete batch, §14).
This is deliberate — it keeps every multi-table effect visible in application
code rather than hidden in schema triggers.

### 8.3 Ratings & the concurrency-safe CAS

Ratings are OpenSkill, computed **at finish, in D1**, because they depend on
global cross-game priors that any snapshot into the DO would render stale (games
can run for days). The whole apply — summary row, rating rows, history log, and
the `finish_id` marker — is **one D1 `batch()`**, so the dedupe marker and the
rows it guards can never disagree.

The write is a compare-and-swap on a per-rating `revision` counter, which fixes
the classic concurrent-finish lost-update bug:

1. Read each identity's `(mu, sigma, revision)` and compute the posteriors in TS.
2. Write each history row with revision-guarded subselects for its before-values
   (`SELECT mu FROM player_ratings WHERE …revision = <the one we read>`), and
   UPDATE the rating `WHERE revision = <that>`, bumping it.
3. If a concurrent finish already moved the revision, the subselect returns NULL,
   the NOT-NULL column rejects the row, the **whole batch rolls back**, and we
   re-read fresh priors and recompute (bounded retry).

The display rating shown on leaderboards is `max(0, round((mu − 3σ) · 40))` —
computed in one place in the kernel.

**The purge guard.** A seat whose account was deleted mid-game still carries its
user id in the DO roster (the purge nulls only D1's mirror — it never wakes every
game). A later rated finish would therefore try to write a `player_ratings` row
for a non-existent user. So the apply reads which identities still exist and
skips the rating write (and its returned delta) for absent ones — while the
purged seat still shapes the OpenSkill field. Bots are never purged.

---

## 9. History & replay

A finished game's DO holds its full transition log forever, so **replay is the
live range-fetch path pointed at a finished DO.** The client asks for a version
range; the DO projects each transition through `computeObservation(…, isReplay:
true)` for the caller's seat (or `null` for a public viewer). Live gap-recovery
and finished-game replay are literally the same endpoint — the only difference is
that a finished game's frames were compacted away, so replay re-projects from the
immutable `transitions` instead of reading the drained `frames` table.

Replay reads go through a one-method **`HistoryStore` seam**. V1 ships exactly one
implementation (the DO range-fetch) and no dispatch logic, but the seam is real:
a future cold tier can add an R2-backed implementation and a
"DO-if-present-else-R2" composition behind the same interface, and the replay
route never changes. Three more seams are already in place for that cold tier: a
store-agnostic replay contract, the field-for-field frozen-blob shape the
compaction already leaves behind, and a nullable `archived_at` column on the
games row that v1 never touches. History *lists* (as opposed to a single game's
replay) always read D1 summaries.

The free runway before any of that matters is ~125k–250k finished games in the
account-wide 5 GB DO SQLite quota.

---

## 10. Identity & authentication

### 10.1 Firebase ID tokens, verified in-worker

Every `/api/engine/*` request carries a Firebase ID token — as `Authorization:
Bearer <token>`, or as `?token=` on WebSocket upgrades (browsers can't set
headers on upgrades). The Worker verifies it with jose against Google's
securetoken JWKS: RS256 pinned (no algorithm confusion), issuer and audience
checked against the configured `FIREBASE_PROJECT_ID`, expiry enforced. A failure
is a deliberately unspecific 401 — signature, expiry, issuer, and audience
failures all read the same to a client ("re-authenticate").

The verified claims carry the uid, `isAnonymous` (the `anonymous`
sign-in-provider claim, which drives every guest gate), and the profile fields
(Google supplies name + picture, Apple usually only email, guests none).

### 10.2 Provisioning & guests

A `users` row appears on first sight of a valid token (the replacement for a DB
signup trigger). Username is derived from the email local part (sanitized to a
`[a-z0-9_.]{3,20}` charset) or a generated `player_NNNNN` handle for guests, with
a collision-retry loop.

Guests are first-class: anonymous sign-in gives a real uid and a real (ephemeral)
account. Because `linkWithCredential` preserves the uid, guest→permanent
conversion is an in-place backfill on the same row — the provider's display name
and avatar overwrite the guest's, while the stable username handle survives.
Guest capability is deliberately narrowed: guests may play (including vs bots,
unrated) but cannot create friends-access games or join rated games. Inactive
guests are swept by the cron (§14).

The **username** is the stable, editable handle (distinct from the provider
display name, which the engine never lets a user edit). `PUT /me/username`
validates the same `[a-z0-9_.]{3,20}` charset and returns a clean 409 on a
collision (the column is UNIQUE). The **display name** and **avatar** come from
the auth provider (or an uploaded avatar, §14); `PUT /me/avatar` is the only way
a user changes their picture.

### 10.3 The social graph

Friendships, search, and blocking are **cross-game and D1-only** — they never
touch a Durable Object. The `relationships` table stores one row per unordered
pair in canonical order (`user_id_1 < user_id_2`) with a `status`
(`pending` / `accepted` / `blocked`) and an `initiated_by` actor, so a single
shared row encodes the relationship and the direction of a request or block is
recovered from `initiated_by`.

- **Requests.** `POST /friends/requests {target_user_id}` inserts a `pending`
  row — unless the target already has a pending request out to the caller, in
  which case it **auto-accepts** (sending back is accepting). `accept`
  transitions the request the *other* party initiated. `DELETE /friends/{id}`
  is the single idempotent unfriend / withdraw / decline. All writes require a
  **registered** caller, and a friend target must be registered too (a guest is a
  throwaway identity).
- **Blocking.** `POST /friends/{id}/block` overwrites any pending/accepted row
  (or creates one) as `blocked`, recording the blocker in `initiated_by`. A block
  in *either* direction refuses new requests; only the blocker can `unblock`.
- **Search.** `GET /users/search?q=` is a case-insensitive substring match on
  username or display name, excluding the caller, guests, and anyone in a blocked
  relationship with the caller, ranked exact → prefix → substring. `LIKE` today,
  D1 FTS5 later; the `%` wildcard is stripped so a caller can't force a scan.
- **Discovery.** `GET /friends/games` lists joinable games created by the
  caller's accepted friends — the lobby that makes `friends`-access games
  reachable.

Friend-event pushes (`friend_request`, `friend_accepted`) fire from the route
through the shared FCM path when a service account is configured. Because these
run in a **stateless Worker** (not the always-alive DO), they ride
`executionCtx.waitUntil` so a slow FCM call never delays the response — the one
place the engine uses `waitUntil` deliberately.

---

## 11. Bots

A bot is a registry row whose `type` selects how its moves are produced:

- **`engine`** — the brain ships *in the game module*, as
  `GameRules.botActions[username]`. When a seated engine bot's turn starts, the
  DO resolves its row → username → move function, runs it **in-process
  post-commit**, and self-applies the returned move as that seat's action (a
  normal serialized command with a deterministic `commandId`, so it dedupes and
  chains through consecutive bot turns). A bot game needs no external service.
- **`external`** — the bot is hosted elsewhere. On its turn the DO sends a single
  signed **wake** carrying the bot's freshly-committed observation; the bot later
  POSTs its move to `/api/bot/action`. Fire-and-forget, single attempt — a lost
  wake rides the turn deadline.
- **`local`** — client-driven, reserved for the future offline-solo transcript
  import. A registry row for identity only; never dispatched server-side.

A bot only ever sees its own seat's projection — the same fog-of-war a human at
that seat gets — so a bot can never read hidden state.

**Seating gates** (shared by add-bot and create-solo, checked at the Worker
before minting): the game must be timed (bots ⇒ timed, so a broken brain is
backstopped by the deadline), the bot must support the schema version, a rated
game needs a rated-eligible bot, an engine bot needs a `botActions` entry for its
username, an external bot needs a webhook, and the game's `botSeatable` hook must
accept the pairing.

### 11.1 External-bot HMAC

Both directions (engine→bot wake, bot→engine action) are authenticated by an
HMAC over the exact message body, using a **per-bot key derived from one engine
secret**:

```
derivedKey = HMAC-SHA256(BOT_SIGNING_SECRET, bot_id)
signature  = "v1," + base64(HMAC-SHA256(derivedKey, "<domain>:<message>"))
```

The `domain` tag (`wake` vs `action`) is *inside* the signed bytes, so a
signature captured in one direction can never verify in the other — no
reflection. The signature travels in the `Eigen-Signature` header both ways.
Registering a bot needs no new secret and no redeploy: the operator is handed
`deriveBotKey(bot_id)` and never sees the master secret. Verification is
constant-time (`crypto.subtle.verify`).

---

## 12. Push notifications

The engine sends best-effort "your turn" and "game over" pushes via FCM HTTP v1.
It is entirely opt-in: with no Firebase service-account configured, the whole
path is skipped.

- **Auth**: a service-account JWT (signed with jose, RS256) is exchanged at
  Google's token endpoint for an OAuth bearer, cached per (account, scope) in
  isolate memory. The same token step serves FCM and the admin account-delete.
- **Targets**: pushes are addressed to a user's **device installations** — one
  row per install, keyed by Firebase Installation ID (FID). Clients register via
  `PUT /api/engine/me/devices { fid, platform }` (upsert-on-FID, so signing in
  reassigns a device) and deregister on sign-out via `DELETE
  /api/engine/me/devices/{fid}` (scoped to the caller). Without a registration,
  a user has no targets and simply receives nothing.
- **Delivery**: on a turn/finish transition the kernel emits `notify_turn` /
  `notify_finished` effects; the DO delivers them post-commit, single-attempt.
  A send that reports a permanently dead installation prunes that row; transient
  failures are left for the next send. There is no retry machinery — the game
  state is the truth and the app catches up on open.

---

## 13. Account lifecycle & the cron

### 13.1 Deletion & guest purge share one path

`DELETE /api/engine/me` (self-service) and the cron's stale-guest sweep both run
`purgeUser`, ordered **games → Firebase → D1**. The order is load-bearing:
because the auth middleware re-provisions a `users` row on *any* valid token,
deleting the D1 row while the Firebase account still lives would let the very
next request resurrect the user. So:

1. Forfeit / cancel / leave every one of the user's live games (a rated forfeit
   applies its ratings while the user row still exists).
2. Delete the Firebase account (Identity Toolkit admin `accounts:delete`). On
   failure this throws **before** any D1 write, so nothing is half-deleted and a
   retry is clean — the route surfaces a 502 ("intact, retry"), never a partial
   deletion.
3. Purge D1 as one explicit `batch()`: anonymize the seats and `created_by` (so
   finished-game history stays readable as "Deleted User"), delete ratings,
   history, relationships, and device rows, then the `users` row last. Delete the
   avatar object if present.

### 13.2 The cron backstop

The `scheduled` handler does only what has no per-entity timer of its own —
notably **not** a timeout sweep (the DO alarm owns that; §7):

- **Stale-guest purge**: anonymous accounts past an age with no recent game
  activity, torn down through `purgeUser`.
- **Abandoned-game reap**: never-started lobbies past a TTL, and untimed active
  games (which have no alarm) idle past a longer TTL — `abort`ed so they stop
  occupying the lobby and release their DO storage.

Both jobs are best-effort, isolated (one failing never blocks the other), and
batch-capped so a backlog drains over days. Every window and cap is a **default
overridable via a `lifecycle` block on `createEngine`** (`guestMaxAgeMs`,
`guestInactivityMs`, `lobbyTtlMs`, `untimedActiveTtlMs`, `guestBatch`,
`reapBatch`).

---

## 14. The web surface — deep links & avatars

The game Worker *is* the deep-link host, so app-link verification and the API
share one domain, one cert, one deploy.

- **App-link files** are **generated** from the `deepLink` config, not
  hand-maintained: `/.well-known/assetlinks.json` (Android App Links) and
  `apple-app-site-association` (iOS Universal Links, served extensionless as
  `application/json` — the content-type a static file gets wrong). One source of
  truth.
- **`/j/:shortCode`** is the share/landing page: it reads the D1 summary for real
  OG tags (host, open seats) so a shared link unfurls richly, and it is the
  *not-installed* fallback — an installed app opens the https URL directly via
  App/Universal Links, so this page is only reached when the app is absent.
- **Avatars** are opt-in R2. Uploads go through the Worker (R2 has no per-user
  access control): a raw-binary `PUT /api/engine/me/avatar` (type/size-validated)
  stores the image under key = uid, and a public `GET /avatars/:uid` serves it
  with a long immutable cache. The stored `avatar_url` carries a `?v=<ts>`
  cache-buster since the key is overwritten on re-upload. An optional
  `avatars.publicBaseUrl` points the URL straight at a bucket custom domain,
  bypassing the Worker for reads — the whole "serve from the bucket" flip is a
  config value, not a code change. The default (worker-served) path is the only
  one that works on a zoneless `workers.dev` deploy.

The whitelabel app's display name is a single required top-level `appName` on
`createEngine` — the one source of truth for engine-owned identity (the `/j`
title and OG tags today; push copy later), independent of which optional feature
blocks are enabled.

---

## 15. Security model

The old stack leaned on Postgres row-level security; this one enforces
authorization explicitly in application code, which keeps every check in view.

- **Every `/api/engine/*` route is token-gated**; the socket upgrade included
  (its `?token=` is verified by the same middleware).
- **Reads are uid-scoped**: "my games", ratings, rating history, and profile all
  filter to the caller. `getPlayers` returns only *public* identity (username,
  display name, avatar, anonymity) — never email. A user's own email is returned
  only by their own `/me`.
- **Game visibility is a capability model.** A game id is an unguessable UUID; a
  private game is unlisted (never in the lobby) and joinable only by someone who
  holds its id or short_code. Reading a game summary requires the id, and the
  sensitive part — the game *state* (frames) — is separately gated: only a
  participant, or anyone for a *finished public* game, may fetch frames.
- **Seat ownership is enforced at the DO** against its authoritative roster, so a
  client (or a misbehaving external bot) can never act on a seat it doesn't hold
  — a clean 403, not a crash.
- **Bot webhooks are HMAC-authenticated** with domain-bound, constant-time
  verification (§11.1); the client cannot forge a bot move and a bot cannot
  reflect a wake into an action.
- **Tokens are RS256-pinned** and issuer/audience-checked; secrets
  (`BOT_SIGNING_SECRET`, the `FIREBASE_*` service account) are read from env by
  convention and absent by default (each feature is simply off when unconfigured).
- **The Worker strips inbound `x-eigen-*` headers** before forwarding a socket
  upgrade to the DO and sets the principal itself — a client cannot spoof its
  identity to the DO.

---

## 16. Failure model

The engine's failure posture is uniform and blunt: **single attempt + error log,
no retry machinery in v1.** This is a deliberate constraint, and it is safe
because the architecture makes almost everything either idempotent or
self-healing:

- A lost **bot wake** or **push** is backstopped by the turn deadline / the app
  catching up on open — neither is a correctness dependency.
- A failed **D1 finish-apply** leaves the DO's `outbox` row in place; a gated
  admin re-poke re-runs it, idempotent via `finish_id`.
- A **duplicate command** replays its stored response (`commandId`); a
  **duplicate finish-apply** is a no-op (`finish_id`).
- A **crashed deletion** never half-deletes (the games→Firebase→D1 order, §13).
- **D1 mirror staleness** is accepted by design — the DO is the truth, and a
  stale summary only ever costs a lobby a clean late rejection.

Post-commit DO effects run as unawaited, self-catching promises (a Durable Object
stays alive while a promise is pending, so `waitUntil` is redundant there). A
genuine server fault — a game-hook bug, a storage failure — surfaces as a 500 and
is logged; it never corrupts the append-only log, because it happens either
before the commit (nothing written) or after it (the commit already stands).

---

## 17. Deployment & configuration

An implementor's entire runtime surface is one `createEngine` call plus a
`BaseGameDO` subclass:

```ts
import { BaseGameDO, createEngine } from "@eigen/server";
import { gameModule } from "./rules";

export class GameDO extends BaseGameDO<Env> {
  protected readonly gameModule = gameModule;
  protected d1(env: Env) { return env.MY_D1; }
}

export default createEngine({
  gameModule,
  appName: "My Game",
  d1: (env: Env) => env.MY_D1,
  gameDO: (env: Env) => env.GAME_DO,
  // optional: deepLink, avatars, lifecycle, firebaseProjectId
});
```

The `EngineConfig` never assumes binding names — the implementor picks each
binding off their own `Env`, and both type parameters infer from the accessors.
Optional blocks (`deepLink`, `avatars`, `lifecycle`) are simply absent when a
feature isn't wanted; the corresponding routes then aren't mounted.

- **Bindings** (in `wrangler.jsonc`): the `GameDO` Durable Object (SQLite
  storage, declared via the `exports` field), the D1 database, optionally an R2
  bucket for avatars, a `public/` assets directory, and a daily cron trigger.
- **Env** (secrets/vars): `FIREBASE_PROJECT_ID` (required for auth), the
  `FIREBASE_*` service-account trio (optional — enables push + admin delete),
  `BOT_SIGNING_SECRET` (optional — enables external bots).
- **Migrations**: the engine owns both schemas. D1 migrations are generated with
  drizzle-kit and applied with `wrangler d1 migrations apply` (never at runtime);
  the DO SQLite schema self-applies inside the DO on activation. An implementor
  never authors a migration or sees the migration machinery.
- **The OpenAPI document** is generated from the route definitions (`pnpm
  openapi`) and vendored into the Dart client repo for codegen.

Host story: with a bought domain, a `custom_domain` on the Worker gives the API
and deep links one host; without one, the free `<name>.<account>.workers.dev`
subdomain works day 0 (App/Universal Links accept any HTTPS host). Avatars and
push each add a payment method only when actually enabled for a deploy.

---

## 18. Cross-repo contract

The game rules exist **twice**: as TypeScript (server-authoritative, this repo)
and as Dart (client-side optimistic preview + rendering, in the client repo).
The two are kept honest by **shared JSON fixtures per version unit**, run by both
the TS and Dart test runners — a drift between the twins fails a test on both
sides. The engine generates the OpenAPI spec that the client's transport is
generated from. This is why the contract in `@eigen/rules` is small and precise:
it is the seam two languages meet at.

For how to actually write a game against that contract, see
[`building_a_game.md`](./building_a_game.md).

---

## 19. The HTTP surface

The full request surface, grouped by the three spaces of §3.2. Every
`/api/engine/*` route requires a Firebase bearer; `/api/bot/action` is
HMAC-authenticated; the web routes are public. The OpenAPI document
(`openapi.json`) is generated from these and is the client's codegen source.

### Client API — `/api/engine`

**Reads** (D1-only, never wake a DO):

| Method + path | Purpose |
|---|---|
| `GET /lobby` | Public joinable games, newest first |
| `GET /games/mine?bucket=active\|finished` | The caller's games |
| `GET /games/{id}` | One game's summary (capability read; never state) |
| `GET /games/{id}/frames?from=&to=` | Version-range frames — live gap recovery **and** finished-game replay |
| `GET /players?ids=` | Batch public identity (≤ 50), never email |
| `GET /bots` | The bot catalog |
| `GET /me` · `GET /me/ratings` · `GET /me/rating-history` | The caller's own profile / ratings |
| `GET /friends` · `GET /friends/requests` · `GET /friends/games` | Social lists |
| `GET /users/search?q=` | Friend-picker search (registered only) |

**Game lifecycle** (Commands to the DO; policy at the edge, integrity in the DO):

| Method + path | Purpose |
|---|---|
| `POST /games` · `POST /games/solo` | Create (Worker-direct D1) · create-and-start vs bots |
| `POST /games/{id}/join` · `POST /games/join-by-code` | Join |
| `POST /games/{id}/leave` · `/cancel` · `/add-bot` · `/start` | Waiting-room commands |
| `POST /games/{id}/action` · `/forfeit` | Active play (carry the caller's `seat`) |
| `GET /games/{id}/socket` | WebSocket upgrade (`?token=` auth); frames + roster snapshots |

**Profile / account / devices / social writes:**

| Method + path | Purpose |
|---|---|
| `PUT /me/username` · `PUT /me/avatar` · `DELETE /me` | Rename · upload avatar · delete account |
| `PUT /me/devices` · `DELETE /me/devices/{fid}` | FCM device register / deregister |
| `POST /friends/requests` · `/requests/{id}/accept` · `DELETE /friends/{id}` | Friend request / accept / remove |
| `POST` + `DELETE /friends/{id}/block` | Block / unblock |

### Bot webhook — `/api/bot`

`POST /api/bot/action` — an external bot submits a move, authenticated by the
`Eigen-Signature` HMAC over the exact body (§11.1).

### Public web

`GET /.well-known/assetlinks.json` · `apple-app-site-association` ·
`GET /j/:shortCode` (share/landing) · `GET /avatars/:uid` (when avatars enabled).

### The error model

Every failure is one JSON shape — `{ error, code? }` — with the HTTP status
carrying the coarse class and the optional stable `code` carrying the machine
reason a client keys retry/resync UX off. Handlers only ever return their
declared 200 shape; a failure is an `HttpError` throw (or a kernel/lobby
rejection converted to one) rendered by the app-level error handler.

| Status | Meaning | Representative `code`s |
|---|---|---|
| 400 | Client mistake | `invalid_payload`, `illegal_move` |
| 401 | Missing/invalid token | — |
| 403 | Ownership/permission refusal | `not_creator`, `not_participant` |
| 404 | No such game/user | `unknown_game` |
| 409 | State conflict — resync and retry | `state_updated`, `not_active`, `not_ready`, `expired`, `not_pending`, `game_full`, `already_joined`, `not_joinable`, `creator_cannot_leave`, `schema_unsupported` |
| 413 / 415 | Avatar too big / wrong type | — |
| 422 | Assertion mismatch (e.g. `rated`) | — |
| 500 | Server fault (game-hook bug, storage) | — |
| 502 | Account deletion upstream failure (intact; retry) | — |

Two reject codes are **not** errors and never reach the client as failures:
`abstain` (a system `timeout` that lost its race — a clean no-op) and the
accepted-lobby-staleness codes, which a client resolves by resyncing. Kernel
rejections are *values*, not exceptions — recomputing one is always sound, so
they are never cached the way accepted commands are.
