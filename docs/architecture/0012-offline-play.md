# 0012: offline play against local bots

- Status: accepted
- Date: 2026-09-12
- Amends: the "client prediction never decides validity" clause of 0002, the
  "Dart does not implement mandatory validity" rule of 0005, and the "no
  durable offline machinery" deferral of 0009, each only for the local-origin
  games defined here.

## Context

A player must be able to start and finish a game with no network, against bots
that run on the device, and later see that game in their history exactly like
any other game. The platform reserved a `local` bot type for "future
offline-solo transcript import" and the shell's solo picker already partitions
untimed play for local bots from timed play for server bots; neither has an
implementation behind it.

Product constraints stated at the outset:

- offline games are eventually synchronized and then behave as ordinary games;
- bot brains may be app-local; local play seats the one human and bots only;
- no local cheating vector: never rated, never involving another participant;
- several local bots, each a real identity with an id, name, and avatar;
- optional: a game implementor may ignore local play entirely;
- no backward-compatibility obligation exists yet.

Direction chosen after weighing an embedded TypeScript runtime against a Dart
implementation: **the game's rules are implemented a second time in Dart for
local play**, an offline game is **imported lazily and appended to as an
ordinary server game**, **Android and web** both ship in the first version, and
the **existing solo picker** exposes it, untimed meaning on-device.

## Decision

### Terms

- A **local game** is a game created on a device with status `active`, one human
  seat for the signed-in user, every other seat a bot, `access = private`,
  `rated = false`, untimed, at the client's latest `schemaVersion`. Its id is a
  client-generated UUID that is also its server id once imported.
- A **local bot** is a bot registry row whose `username` the Dart module ships
  a brain for. Its identity stays server-owned; only the brain is local.
- A game's **origin** is `online` or `local`, stored on the D1 row and the DO
  `meta`, immutable, and carried on `GameSummary` and `Session`.

### Rules contract: the Dart local unit

Each Dart `GameRules` version unit MAY expose a `LocalGameRules` unit. Absence
means the version cannot be played locally and the picker shows no local bots
for it. The unit is the transcription of the four authoritative TypeScript
hooks plus the bot brains:

```dart
abstract class LocalGameRules<TState, TObs, TAction, TConfig> {
  Envelope<TState> initialState({required TConfig config, required Rng rng, required int playerCount});
  Envelope<TState> applyAction({required TState state, required List<int> pending, required TAction data, required int playerIndex, required Rng rng, required TConfig config});
  Envelope<TState> applyLifecycle({required TState state, required List<int> pending, required LifecycleAction data, required Rng rng, required TConfig config});
  ObservationSlice<TObs> computeObservation({required TState state, required List<int> pending, required int? playerIndex, required int participantCount, required TransitionCause<TAction> cause, required bool isReplay, required TConfig config});
  Map<String, LocalBotAction<TAction, TObs, TConfig>> get botActions;
}
```

`eigen_codegen` gains a generated `State` payload type per version and a typed
`<Game>V<N>LocalRulesBase` with `parseState`/`serializeState`, so a hook returns
typed values and the local kernel validates the returned state by round-tripping
it through the generated codec, the same check the server performs with the
schema. Parameter names mirror `ApplyActionArgs` and friends so the two
languages read side by side, exactly as `isValidAction` already does.

`botActions` is the twin of the TypeScript `botActions`, keyed by the same
usernames. A username present on both sides is one bot usable in both modes.
A username present only in Dart is a `local`-type registry row. External bots
are never local.

### The local kernel

`eigen_client` gains a pure-Dart `local/` module: a port of the kernel's
`commit()` restricted to what a local game can need. It handles the `start`,
`action`, and `forfeit` intents. Timeouts, budgets, deadlines, and the
same-view rule are omitted, because a local game is untimed and the device is
its only actor, so `expectedVersion` always equals the current version. The
guards are ported verbatim: hook-returned state must parse, a forfeit must
remove its seat from pending, a pending seat must be identified, and
`computeObservation` must be truthful about the seat's own pending status.
Outcomes are validated as on the server.

Randomness MUST be bit-identical to the server: the kernel derives each
transition's stream as rand-seed's `sfc32` seeded by an FNV-1a variant over
`"<seed>:<version>"`, with every step in 32-bit integer arithmetic. The Dart
port MUST implement a 32-bit multiply that is exact on the web, where `int` is
a JavaScript number, and MUST be proven by generated fixtures rather than by
inspection. Bot streams use the server's `"<seed>:bot<seat>"` derivation.

### The local engine and store

Starting a local game needs no network: the device generates the game id and
the seed, runs the local unit's `initialState` through the local kernel,
persists the record, and opens the screen. The only offline prerequisites are
a user session Firebase restored from a previous sign-in, the bot catalog from
a previous online session, and the application itself. The persisted bot
catalog MUST stay usable past its refresh window while the device is offline,
refreshing only when a fetch succeeds, so an expired cache can never empty the
local picker.

`LocalGameEngine` is the device's Durable Object: one serialized command queue
per local game holding the record the DO holds, meta, roster, the append-only
transition log with state and action, and per-seat frames. A human action
commits, then every newly pending bot seat runs its brain and commits in the
same queue until a human is pending or the game ends. The engine emits the same
`Session` snapshot the socket emits, with `seq` advancing per commit, so the
game screen, replay, history, and `buildContent` consume a local game through
the existing `GameSession` path with no game code change.

`LocalGameStore` is a pure-Dart port: list, load, save, and delete records per
user id. The Flutter adapter implements it with Drift on both native and web.
On web, Drift's WASM database picks the best implementation the browser
offers. The shell does not send cross-origin isolation headers, because they
break the sign-in popup it relies on, so the shared-OPFS path is never one of
them; what remains is lock-based OPFS or IndexedDB, both of which persist.
Nothing here pins one, and no correctness claim rests on which is chosen.
Local records are scoped by the owning user id, survive sign-out, and are
deleted with the account.

Persisted provider snapshots move into the same database rather than keeping a
second engine beside it: the web had no persistence at all before this, and a
device that forgets the bot and player catalogs cannot name the seats of a game
it is already playing. Both of those caches therefore stop expiring. Their
network refresh still runs on every build, so an online device is always
current; what an expiry would add is the ability to empty them while offline,
which is precisely the state they exist for.

### Synchronization

Synchronization is append-only replay of the local transition log into the
authoritative Durable Object, so the server's copy is produced by the
TypeScript rules and the local copy is what the player saw. It runs in the
background whenever the device is online: on app start, on connectivity
regained, after a local finish, and on leaving a local game's screen. It never
blocks local play.

1. `POST /api/engine/games/local` creates and starts the game from `gameId`,
   `schemaVersion`, `config`, `seed`, `botIds`, and the claimed `createdAt`. The
   route validates exactly what `createSoloGame` validates minus the timed rule,
   then forces `access = private`, `rated = false`, untimed, `origin = local`.
   Every bot MUST be a registry row of type `local` or `engine`. A game id that
   already exists for the same creator answers with the existing session, which
   is the create's idempotence.
2. `POST /api/engine/games/{gameId}/local/transitions` appends
   `{ fromVersion, transitions: [{ seat, kind, data }] }`, creator only, origin
   `local` only, bounded per request so a long game syncs in batches inside the
   existing body limit. The DO applies each as an ordinary `action` or `forfeit`
   command at the current version. A rejection stops the batch and returns the
   rejecting index and the server session; the client marks the record
   `diverged`, stops local play on it, and shows the server copy. A refusal for
   a stale version is NOT divergence by itself: a lost append response leaves
   the server holding this device's own moves at a version it does not expect
   to be at, which is indistinguishable from another device's moves by version
   alone. The client MUST compare the state the server holds at its own version
   with the one this device committed there, and only a difference in that
   state is a divergence.
3. The client records `syncedVersion` per game and resumes from it.

An import batch is one Durable Object request that commits its transitions in
sequence. The per-transition D1 summary mirror the live path fires after every
commit MUST be collapsed to one write at the end of the batch, so a long game
costs a handful of D1 rows rather than one per move. Server cost per imported
game is therefore lower than for the same game played online: no per-move
Worker and Durable Object requests, no socket keeping the object in memory,
no alarms. What remains is the retained transition log, under the same
indefinite retention every game already has.

The Durable Object accepts, for a local-origin game only, an action on a bot
seat from the creator's principal, logged with `type = "bot"`. That is the one
new trust rule and it is scoped three ways: origin `local`, seat type `bot`,
actor equal to `createdBy`. Bot wakes, turn pushes, and finish pushes are
suppressed for local-origin games, and so are alarms: a local game is created
untimed, but a version's `applyAction` may still return an envelope
`turnSeconds`, which the kernel honours ahead of the untimed branch. The Dart
`Envelope` carries no such field and the device therefore cannot produce one,
so an armed alarm would commit a timeout the device knows nothing about and
collide with its next batch.

A local game is also unjoinable. It carries a short code like every game, and
between the create and start writes it sits at `ready`, so the join paths MUST
refuse origin `local` outright rather than rely on its status. Its recorded
seat range is its roster, which is what the device's own session reports for
the same game. The abandoned-game reap applies unchanged;
a client whose record the server has aborted marks it aborted on its next sync.

The `start` command carries an optional client seed only on the import route.
`Bot` on the wire gains `type` so the picker can exclude external bots without
guessing. `GameSummary` and `Session` gain `origin`.

### Product behavior

- The solo picker's untimed mode lists bots whose username has a Dart brain in
  the latest local unit and whose type is not `external`; choosing one creates a
  local game and opens it immediately. Timed mode is unchanged: server bots via
  `createSoloGame`. A game whose module ships no local unit, or whose creation
  spec has no untimed option, shows no local entry.
- Home lists local games alongside server games with an on-device badge; a
  synced local game is one entry. History lists finished local games whether or
  not they have synced.
- A bot never mixes modes inside one game: a local game seats local brains only
  and a server game seats server-dispatched bots only. One registry identity
  MAY be playable in both.
- Web ships a service worker that precaches the application shell, because
  Flutter no longer generates one, registered at the root scope beside the
  messaging worker's own scope. The scaffold supplies it.

### Resuming a local game on another device

A local game is fully described by its seed and its transition log, and the
server holds both once the game is imported. `GET /api/engine/games/{gameId}/local`,
creator only and origin `local` only, returns what a device needs to continue:
meta, roster, `seed`, and every transition with its raw state and action. The
seed and raw state leave the Durable Object here by design: the requesting
principal is the game's only human and already holds both on the device that
played it, so nothing is revealed that a participant could not already see,
and there is no other participant to gain from it.

A client opening a local-origin game it holds no playable record for pulls the
record, re-derives every seat's frame through its own rules rather than
transferring them, rebuilds the local engine at the newest version, and
continues locally. The record route pages, so the client MUST follow its pages
to the end of the log: a pull that stops short is refused at rebuild rather
than resumed from, because a log missing its tail is a different game, not a
degraded one. Every device appends against the server version, so two devices
continuing the same game concurrently make the second to append fail; its
unsynced moves are discarded as `diverged`, and the record is pulled again on
the next open, which is what makes a divergence recoverable rather than a game
the player can never reopen. Before continuing a
pulled game the client MUST verify that this build ships the game's
`schemaVersion` with a local unit and a Dart brain for every bot username on
the roster; otherwise the game is shown read-only with the update-required
affordance the shell already has.

### Running bot brains

Bot brains are game code with unbounded cost, and the local engine invokes them
on the device. The engine runs them through a `BotRunner` port. On native, the
Flutter adapter runs each brain in a short-lived isolate through `Isolate.run`,
so a slow brain never drops a frame; a brain, its rules unit, and its inputs
must therefore be sendable: const rules units, plain JSON-like values, and no
captured provider or widget. On the web, where Flutter has no isolates, the
adapter runs the brain on the main thread; a brain that thinks for long MUST
yield cooperatively, which the `FutureOr` return of `LocalBotAction` permits.
Moving web brains into a Web Worker later needs a separately compiled worker
entry point, a scaffold build change and not a contract change. While a brain
runs, the human's controls stay disabled through the existing `actionPending`
state, and the engine passes each brain a time budget as a hint.

## Invariants

Unchanged: one Durable Object is authoritative for each initialized game; D1 is
a registry and read model; TypeScript rules decide what the server records;
creation constraints are server-enforced; time and randomness are explicit
commit inputs.

Amended for local-origin games only: the Dart local unit decides validity on the
device until import, and the server's replay is the record of the game. A
divergence between the two is a twin defect surfaced as `diverged`, never
silently resolved in the client's favor. The client durably stores local
transition logs, which is a game record, not a command queue: no command
identity, receipt, or retry policy is introduced.

## Testing

- The Dart twin-fixture runner checks `expected.state`, `expected.pending`,
  `expected.outcome`, and `expected.observation` against the local unit when a
  version ships one, with the same files the TypeScript runner already checks.
  `expected.observation` is the one that matters most and the one easiest to
  leave out: the `GameRules` hooks a fixture otherwise exercises are the
  optimism hooks, and a local unit that hands a seat its opponent's hidden
  commit passes every one of them. The comparison is of VALUES, not documents,
  because the two sides are independent codecs for one schema and a field the
  schema marks optional and nullable may be written by one and omitted by the
  other.
- New fixture kinds: `initialState`, `lifecycle`, and `transcript` (seed,
  config, ordered transitions, expected final state and outcomes), each
  validated by both runners; and `rng` (seed, version, count, expected draws),
  generated by the testkit from the TypeScript kernel so the Dart port cannot
  drift unnoticed.
- Server tests cover the two import routes end to end, including the bot-seat
  trust rule's three guards, idempotent create, batch rejection, and reap.
- The scaffold ships a local unit for its counter game, and its checks build
  the web target and assert the three offline assets land in it. Android is not
  built by `tool/check.sh`; the native path is covered by tests rather than by
  a build.

## Delivery

1. Kernel port and RNG fixtures in `eigen_client`; codegen `State` type and
   local rules base; twin runner extension. No product change yet.
2. Server: origin column, import routes, DO trust rule and effect suppression,
   OpenAPI and Dart client regeneration.
3. Local engine, Drift store on native and web, session provider branch, solo
   picker, home and history merge, sync coordinator.
4. Web service worker and scaffold templates; documentation on
   eigeninteractive.com (bots, the contract, testing, creation UI).
5. Cross-device resume: pulling a local record back through the read route and
   rebuilding its frames, with the build compatibility checks.

All five are implemented. The catch-up is driven by the session rather than by
the store, so an ordinary game is recognised from the snapshot the socket
already delivered and costs no request; a device that declines a game, for a
missing local unit or a missing brain, leaves it readable and refuses commands
with `localOnly` rather than committing a turn no bot would answer. A record
whose `schemaVersion` this build no longer ships fails with the same
update-required error a server game of that version does, which names the
reason rather than blaming the device the game came from.

## Open questions

- A device that has never signed in has no user id, and the login gate needs
  the network for the guest sign-in. The first version assumes a user who has
  signed in at least once on the device, whose session Firebase restores
  offline. Device-scoped local play before any sign-in would need a device
  identity later attributed to the user id, and is deferred.
- Local games appear in history and count for device-local counters such as
  the in-app review prompt's win total. They are never rated. Whether they count
  for any future profile counters, achievements, or leaderboards other than
  ratings is a further decision, and the `origin` column makes either answer
  implementable.
- Web bot brains run on the main thread in the first version; a Web Worker
  adapter is a later build-step addition.
- Two of a player's devices playing one local game at once resolve as an
  ordinary divergence rather than a merge. A merge is not obviously desirable
  here, since the two would have played different games from the same position,
  but the question is open if it ever bites.
