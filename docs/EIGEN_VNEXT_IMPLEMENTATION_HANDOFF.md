# EigenInteractive vNext: architecture and end-to-end implementation handoff

> Status: implementation plan, not yet implemented
>
> Review date: 2026-08-12
>
> Audience: the engineer or coding agent responsible for taking EigenInteractive
> from its current early-development state to a coherent vNext platform
>
> Scope: `eigen-server`, `eigen-flutter`, and `eigen-web` as one product

## Contents

1. How to use this document
2. Review snapshot and baseline
3. Executive decision
4. Product definition
5. Decision register
6. Non-negotiable invariants
7. Current architecture
8. Target architecture
9. Confirmed defects and implementation specifications
10. Package and repository implementation
11. Server target design details
12. Client and Flutter target design details
13. Observability and operational requirements
14. Documentation corrections and target information architecture
15. End-to-end execution plan
16. Required reference games
17. Test architecture and CI matrix
18. API and storage migration inventory
19. Acceptance criteria by invariant
20. Risks and rollback strategy
21. Rules for the implementing agent
22. Definition of done
23. Evidence index
24. Immediate next action

## 1. How to use this document

This is intended to be sufficient for another agent to execute the redesign
end to end without reconstructing the original review. It records:

- the product being built and its non-goals;
- the architectural decisions that should be retained or replaced;
- confirmed correctness, security, reliability, and contract defects;
- the recommended greenfield-quality target architecture;
- implementation work packages and their dependency order;
- API and data-model sketches;
- migrations, tests, documentation, observability, and acceptance criteria;
- owner-only approval gates and unresolved product choices.

This is deliberately a clean vNext plan. The platform has no production apps or
users, so preserving accidental early-development compatibility is less valuable
than making the contract simple and correct. Do not add indefinite compatibility
layers merely to avoid changing unpublished APIs. Preserve Git history and
use normal migrations while working, but prefer an explicit development-data
reset over complex legacy migration code when the owner approves it.

Before editing anything, the implementing agent must:

1. Read the `AGENTS.md` in every repository it will touch.
2. Re-read the live Eigen documentation at
   <https://eigeninteractive.com/llms-full.txt>.
3. Re-read current official Cloudflare documentation for Workers, Durable
   Objects, D1, alarms, rate limits, and any other platform feature being used.
4. Revalidate all file and line references below; they are evidence from the
   review snapshot, not permanent anchors.
5. Check all three worktrees. Never reset, overwrite, or silently absorb user
   changes.
6. Capture clean test/typecheck/build baselines before moving repositories or
   changing generated artifacts.

Remote repository archival, history rewriting, production deployment,
credential changes, billing changes, and destructive data resets are **not**
authorized by this document. They require explicit owner approval.

## 2. Review snapshot and baseline

The review took place while active work was landing in the server and Flutter
repositories. There are therefore two baselines: immutable commit anchors and
uncommitted local work that must be preserved. At handoff finalization on
2026-08-12, the local state was:

| Repository | Path | Current `HEAD` | Worktree | Published line |
| --- | --- | --- | --- | --- |
| Server | `/Users/seenuk/projects/eigeninteractive/eigen-server` | `a9efd0b6812b9a57a27f21ccd3085749c683a85e` on `main` | modified and untracked pagination/cursor work | engine packages `0.3.1`; scaffolder `0.10.2` |
| Flutter | `/Users/seenuk/projects/eigeninteractive/eigen-flutter` | `618369aa10bcd46939227c09201b858304497d58` on `main`, tag `v0.5.0` | modified and untracked pagination/client work | `eigen_flutter 0.5.0` |
| Web/docs | `/Users/seenuk/projects/eigeninteractive/eigen-web` | `a4d6f08e0b82960693816f67859ea0470416a4ba` on `main` | clean | current docs label `0.3.x` |

The deep Flutter read and its test run began at
`4d1687b992273004c9e3115f85d5a8e6f3482326`; `main` later advanced to the
`v0.5.0` commit shown above. The server remained at the same commit while its
local cursor and pagination implementation changed. Findings unrelated to that
work were retained; pagination-specific findings must be revalidated against
the completed change.

The dirty paths at finalization were the following. This is a preservation
warning, not a request to commit, discard, or incorporate them:

```text
eigen-server:
  modified: clients/dart/doc/{FriendsGames,GamesApi,Lobby,MyGames,PlayerGames,PlayersApi,SocialApi}.md
  modified: clients/dart/lib/src/api/{games_api,players_api,social_api}.dart
  modified: clients/dart/lib/src/model/{error_code,error_response.g,friends_games,friends_games.g,lobby,lobby.g,my_games,my_games.g,player_games,player_games.g}.dart
  modified: packages/server/openapi.json
  modified: packages/server/src/d1/{reads,social}.ts
  modified: packages/server/src/http.ts
  modified: packages/server/src/routes/{games,reads,social,wire}.ts
  modified: packages/server/test/{engine,social}.spec.ts
  untracked: .changeset/opaque-pagination-cursors.md
  untracked: packages/server/src/cursor.ts
  untracked: packages/server/src/routes/query.ts
  untracked: packages/server/test/query-contract.spec.ts

eigen-flutter:
  modified: lib/core/errors/error_messages.dart
  modified: lib/features/game/data/game_repository.dart
  modified: lib/features/game/presentation/screens/{history_screen,lobby_screen}.dart
  modified: lib/features/game/providers/game_providers.dart
  modified: lib/features/social/data/social_repository.dart
  modified: lib/features/social/providers/social_providers.dart
  modified: test/shared/api_contract_test.dart
  untracked: lib/core/api/games_page.dart
```

This list is only a timestamped snapshot. The implementing agent must run
`git status --short` in all three repositories immediately before making any
change and must not assume that later differences belong to this plan.

Review verification results:

- `@eigeninteractive/server`: 17 test files, 183 tests passed.
- `@eigeninteractive/kernel`: 4 test files, 73 tests passed.
- `@eigeninteractive/testkit`: 2 test files, 17 tests passed.
- `create-eigen-game`: 6 test files, 80 tests passed.
- Server, kernel, rules, testkit, and scaffolder typechecks passed in completed
  review runs. The server typecheck temporarily failed while the pagination
  edit was incomplete because `invalidCursor` was absent from an exhaustive
  error-message map; a final rerun against the handoff worktree passed.
- `flutter analyze`: no issues.
- Flutter package tests: 234 passed.
- Flutter example tests: 21 passed.
- Flutter Chrome socket tests: 3 passed.
- Web docs version/admonition checks, TypeScript typecheck, and production build
  passed; 53 documentation pages were generated.
- The live `llms-full.txt` and OpenAPI document matched the published web source
  during the review.

These are point-in-time results, not proof about the moving worktrees above.
Re-run the complete baseline after reconciling the in-progress work and before
the first semantic vNext change.

One local aggregate server test invocation failed only because the managed
sandbox prevented Wrangler from writing its log and binding `127.0.0.1`; the
same server suite passed when run in an environment with the required
permissions. This is not a product failure.

Passing tests do **not** mean the design is production-correct. Several tests
encode the current behavior, including one of the clock defects described
below. vNext needs invariant, property, fault-injection, integration, and
release-path tests in addition to ordinary unit coverage.

## 3. Executive decision

Do not rewrite the core coordination model. Redesign the product boundaries
around it.

The central architectural decision remains excellent in 2026:

> Each game is one server-authoritative serialized state machine owned by one
> SQLite-backed Cloudflare Durable Object.

Cloudflare's current guidance explicitly identifies multiplayer coordination as
a Durable Object use case and recommends choosing one object per natural unit
of coordination. Relevant primary sources:

- <https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/>
- <https://developers.cloudflare.com/durable-objects/best-practices/error-handling/>
- <https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/>
- <https://developers.cloudflare.com/durable-objects/platform/limits/>
- <https://developers.cloudflare.com/d1/platform/limits/>

The largest risks are at the seams:

- some authoritative game setup policy currently lives only in Flutter;
- mutation idempotency is optional and is not scoped safely;
- version negotiation is unsound for sparse supported versions;
- committed deadlines and finish side effects do not have complete automatic
  recovery loops;
- Flutter has no single coordinator that owns mutation responses, socket
  snapshots, reconnection, persistence, and terminality;
- the client package combines a headless SDK, Firebase integrations, and an
  entire opinionated app;
- TypeScript rules, Dart business-rule twins, JSON Schema, fixtures, OpenAPI,
  generated clients, and prose all overlap as authorities;
- three platform repositories create avoidable release and synchronization
  machinery.

The recommended call is:

1. Keep the Durable Object, deterministic kernel, per-seat projection, D1 read
   model, append-only transition ledger, and complete session snapshots.
2. Fix the confirmed P0 correctness and security defects first.
3. Establish one authoritative game definition in TypeScript and generate the
   portable client contract.
4. Build one durable client-side game coordinator.
5. Split the headless client from Flutter UI, the optional product shell, and
   Firebase.
6. Consolidate the platform into one monorepo with independently publishable
   packages and a single tested platform release manifest.
7. Prove the result through three substantially different reference games,
   fault injection, browser E2E, and Android release builds.

## 4. Product definition

### 4.1 Recommended product

EigenInteractive vNext is a toolkit for shipping a dedicated, branded,
server-authoritative turn-based game application:

- one game app owns one Worker deployment, domain, database, and player
  population;
- game rules execute only on the server;
- clients receive only a viewer-safe observation and submit typed intents;
- games may be sequential or simultaneous and may contain hidden information;
- the engine owns serialization, persistence, reconnects, deadlines, history,
  identity boundaries, and optional cross-game capabilities;
- game authors provide authoritative TypeScript rules and a typed Flutter
  renderer;
- a default app shell is available, but an existing Flutter app can embed the
  headless client without adopting Eigen's router, Firebase, analytics, social
  product, or visual opinions.

### 4.2 Supported game class

The design center is asynchronous or human-speed turn-based play:

- deterministic state transitions;
- one or multiple currently actionable seats;
- hidden information and per-seat projections;
- reconnect after arbitrary client absence;
- untimed, fixed-per-action, and accumulated-budget clocks;
- optional bots;
- optional ratings;
- replay/history with an explicitly chosen fidelity policy;
- small-to-moderate JSON state and action payloads within engine-enforced
  budgets.

### 4.3 Explicit non-goals for this vNext

- sub-second physics or twitch-action networking;
- a centrally managed multi-tenant Eigen gaming service;
- skill-based global matchmaking and tournament orchestration;
- arbitrary offline write synchronization;
- a cross-language rules VM or custom rules DSL;
- client authority over state, setup, time, rating, or bot policy;
- mandatory social graphs, avatars, push, analytics, reviews, or store tooling;
- R2 cold-history tier before measured usage requires it;
- microservices or a generic distributed event bus around a per-game command;
- preserving unpublished `0.x` compatibility at the expense of the vNext
  contract.

If the desired product is instead a managed multi-tenant platform, stop before
implementation. Tenancy, deployment ownership, identity, billing, isolation,
abuse control, data locality, and operations would need a separate architecture
RFC.

## 5. Decision register

The following are the recommended defaults. Treat them as approved by this plan
unless the owner explicitly chooses otherwise when authorizing implementation.

| Decision | Recommended choice | Reason |
| --- | --- | --- |
| Per-game authority | One SQLite Durable Object per game | Natural serialized coordination unit; matches the platform |
| Global data | D1 read model and registry only | Keeps live arbitration in the DO while enabling list/search/rating queries |
| Authoritative rules | TypeScript only | Eliminates split-brain business policy |
| Client contract | Generated typed codecs, validators, descriptors, and exact contract IDs | Portable without duplicating authority |
| Client prediction | Optional, non-authoritative UX helper | Avoids mandatory duplicated rules |
| Mutations | HTTP with required client-created idempotency keys | Simple request semantics and safe ambiguity recovery |
| Server stream | One-way WebSocket of complete per-seat sessions | Complete snapshots are easy to dedupe and recover |
| Client state | One serialized per-game coordinator | Makes HTTP/socket/cache ordering one deterministic system |
| Auth | Interface in core; Firebase adapter and default preset | Removes a hard product dependency while preserving the current path |
| Flutter packaging | Headless pure-Dart client, Flutter adapters, optional shell | Supports both quick-start and embedding |
| Platform repository | One monorepo | Atomic contract, docs, examples, CI, and release compatibility |
| Game projects | Remain separate scaffolded repositories | Game source and platform source have different ownership/lifecycles |
| Compatibility | Clean breaking vNext plus an exact tested platform manifest | No production users justify removing accidental complexity |
| Version negotiation | Protocol capabilities plus exact game contract IDs/digests | Maximum integers cannot represent sparse support |
| Local development | Works without Firebase or cloud credentials | Minimizes time to first playable move |
| Cold history | Defer R2 | No measured need; keep the storage model simple |

### 5.1 Owner decisions that must be recorded before their work package

These do not block early correctness work, but they affect later implementation:

1. **Replay fidelity**: retain exact per-seat delivered frames, or guarantee an
   immutable historic projector. Recommendation: retain frames for exact replay
   until data proves that storage is a problem.
2. **History retention**: forever, configurable duration, or user/game deletion.
   Recommendation: a documented configurable policy with a conservative
   default, plus explicit deletion/export behavior.
3. **Opaque state and personal data**: forbid PII inside game state, or provide a
   game-specific redaction hook. Recommendation: forbid PII in state initially;
   add redaction only when a real game needs it.
4. **Production auth presets**: Firebase only, or Firebase plus another adapter.
   Recommendation: keep Firebase as the first production adapter but make the
   core interface independent.
5. **Application budgets**: seats, clocks, state/action/config bytes,
   transitions, replay page bytes, concurrent sockets, and retention.
   Recommendation: pick deliberately small turn-based-game defaults; never use
   Cloudflare platform maxima as product limits.
6. **Remote repository consolidation**: preserve the three remotes as archived
   history, or migrate histories into one new remote. Requires explicit owner
   authorization and a documented migration procedure.

## 6. Non-negotiable invariants

Every implementation and test should be traceable to these invariants.

### Authority

1. The server alone decides valid setup, action legality, state transitions,
   pending seats, time, outcome, rating eligibility, and bot eligibility.
2. A client sends an intent, never authoritative derived state.
3. Full game state never crosses the Durable Object boundary except through a
   game-defined projection for a specific viewer.
4. A projection for one seat is never returned from a command issued by another
   principal.

### Mutation correctness

5. Every mutation has a stable client-created identity before its first network
   attempt, including create and join.
6. A dedupe record is scoped to principal, operation, target, and canonical
   request hash—not merely a string key.
7. Repeating the same mutation returns the same semantic result exactly once;
   reusing its identity for another request returns a conflict.
8. Automatic retries occur only for idempotent operations with the same
   identity and only for classified transient errors.

### Game consistency and time

9. Only the owning Durable Object serially changes a game after creation.
10. A committed transition, frames, dedupe result, desired deadline, and finish
    outbox entry are atomic where applicable.
11. Time spent is charged according to the timing mode of the turn that just
    ended, not the mode of the next turn.
12. Every committed desired deadline is eventually represented by the correct
    alarm, without requiring another player action.
13. A finish is eventually applied to D1 and its outbox cleared without manual
    intervention.

### Client convergence

14. Mutation responses, socket snapshots, recovered gaps, and cached snapshots
    enter one serialized reducer.
15. Duplicate or older sessions cannot regress state.
16. A terminal game cannot be resurrected by a delayed non-terminal snapshot.
17. Unknown or incompatible wire data becomes an explicit client state; it is
    never silently dropped while the UI appears live.
18. Offline/stale state is visibly marked and writes are disabled unless an
    explicit durable mutation workflow supports them.

### Contracts and history

19. Supported portable schema semantics are explicit; unsupported semantics
    fail generation.
20. Exact game-contract compatibility is checked before seating or creation.
21. The server advertises which contract may create new games; an old client
    cannot create a retired schema forever.
22. Historical replay fidelity, projector lifetime, retention, and privacy are
    explicit and covered by tests.

### Developer experience and operations

23. A newly scaffolded game reaches its first local playable move without
    Firebase, a Cloudflare account, or production credentials.
24. Generated source, OpenAPI, clients, examples, and docs change atomically.
25. Operators can identify and repair stale read models, delayed alarms, stuck
    outboxes, incompatible clients, and reconnect storms.

## 7. Current architecture

### 7.1 Runtime shape

```text
Flutter app
  ├─ Firebase Auth ID token
  ├─ generated eigen_api over HTTP ───────────────┐
  └─ one WebSocket per open game (server -> app)  │
                                                  v
Cloudflare Worker / Hono
  ├─ auth, policy, routing, OpenAPI
  ├─ D1 reads and cross-game writes
  ├─ public share/legal/app-link surface
  └─ Durable Object stub by game ID
                     │
                     v
SQLite Durable Object: one per game
  ├─ authoritative metadata and roster copy
  ├─ pure-kernel commit
  ├─ append-only transitions
  ├─ live per-seat frames
  ├─ command-response dedupe
  ├─ desired turn deadline -> alarm
  ├─ finish outbox -> D1 ratings/summary
  └─ hibernatable WebSockets

D1
  ├─ users, relationships, devices, bots, ratings
  ├─ game registry and list/search summaries
  └─ participants display/read model

Optional/currently coupled services
  ├─ Firebase Admin / FCM
  ├─ R2 avatars
  └─ external bot webhooks
```

### 7.2 Current sources of contract truth

1. TypeScript `GameRules` schemas and hooks.
2. `game-contract.json` with JSON Schemas and authored twin fixtures.
3. Generated Dart payload classes/codecs.
4. Handwritten Dart legality, preview, rating, and bot predicates.
5. OpenAPI emitted by `eigen-server`.
6. Generated `eigen_api` committed in `eigen-server` and consumed by Flutter.
7. Handwritten task documentation and generated OpenAPI/TypeDoc in
   `eigen-web`.
8. Compatibility-table workflows coordinating independently released repos.

The volume is not itself the problem. The problem is overlapping semantic
authority and asynchronous publication.

### 7.3 Current package ownership

`eigen-server` contains:

- `@eigeninteractive/rules`: public rule contract and JSON types;
- `@eigeninteractive/kernel`: pure commit/timing/observation/rating logic;
- `@eigeninteractive/server`: Worker, D1, Durable Object, auth, social, push,
  sites, and OpenAPI;
- `@eigeninteractive/testkit`: kernel scenarios, contract emission, fixtures,
  and local-store inspection;
- `create-eigen-game`: the scaffolder;
- the generated Dart `eigen_api` client.

`eigen-flutter` contains the generated-client wrapper, session/reconnect logic,
payload generator, game rendering contract, Riverpod state, persistence,
Firebase auth/push/analytics/crash integration, navigation, and the full
whitelabel application.

`eigen-web` contains task documentation, generated API/TypeDoc reference,
compatibility automation, landing/static assets, and the `llms` surfaces.

### 7.4 Strengths that must survive

- One serialized owner per game, avoiding shared-row lock races.
- A pure kernel with injected clock and deterministic RNG.
- Runtime validation of client payloads, hook output, and observations.
- Per-seat projection before transport, so hidden information is absent from
  bytes sent to other players.
- Atomic transition, frame, dedupe, and outbox storage inside the game DO.
- Append-only transition history.
- Complete, self-describing session snapshots ordered by a monotonic `seq`.
- HTTP commands separated from a one-way server stream.
- Hibernatable WebSockets and per-game alarms.
- D1 as a read model rather than a live-game arbiter.
- Cross-game rating CAS logic and idempotent finish IDs.
- Generated OpenAPI client, migration drift checks, scaffold E2E, workerd tests,
  twin fixtures, and task-first documentation.

## 8. Target architecture

### 8.1 One platform monorepo

Create a new `eigen-platform` repository or convert one current repository after
the owner approves remote/history strategy. A suggested logical layout:

```text
eigen-platform/
  packages/
    rules/                 # public TS GameDefinition types and helpers
    kernel/                # pure authoritative game transition core
    server/                # Worker, DO, D1, HTTP and operational surfaces
    protocol/              # protocol schemas, capability manifest, OpenAPI
    dart_protocol/         # generated pure-Dart wire models/codecs
    dart_client/           # pure-Dart transport, coordinator, journal, storage interfaces
    flutter/               # Riverpod/widget adapters and typed rendering surface
    flutter_shell/         # optional opinionated app
    firebase_adapter/      # optional Firebase auth/push/analytics/crash adapter
    game_codegen/          # contract/profile validation and Dart generation
    testkit/               # model, fixture, chaos and local inspection tools
    create_eigen_game/     # scaffolder
  examples/
    hidden_simultaneous/
    budget_override/
    multiplayer_teams/
  docs/
  tooling/
  pnpm-workspace.yaml
```

The exact package count may be collapsed where publication constraints make it
useful, but the dependency direction must remain:

```text
protocol types
     ^
     ├──── server/kernel
     └──── pure Dart client
                 ^
                 ├──── Flutter adapters
                 │          ^
                 │          └──── optional app shell
                 └──── optional Firebase adapter
```

The pure Dart client must not import Flutter, Riverpod, Firebase, navigation,
analytics, or widgets. The Flutter integration must not require the optional app
shell. The Firebase adapter implements interfaces owned by core packages; core
never imports Firebase.

### 8.2 Deployment shape

Preserve one dedicated Worker/D1/game-DO namespace per deployed game app.
Optional modules are enabled by configuration and bindings:

```text
Required core
  Worker + SQLite Durable Objects + D1 registry/read model

Optional adapters/modules
  Firebase authentication
  FCM push
  social/friends
  ratings
  bots
  R2 avatars
  public marketing/legal pages
```

A minimal game should not need service-account credentials, push setup, social
tables, avatar storage, ratings, or store-release configuration. Production
presets may enable several modules together, but package/API boundaries must not
make them core requirements.

### 8.3 Authoritative game definition

Replace the current mix of mandatory hooks and client-owned creation policy with
one versioned server definition. Illustrative shape—not a frozen signature:

```ts
interface GameDefinition<State, Observation, Action, Config> {
  readonly contract: {
    readonly name: string;
    readonly schemaVersion: number;
    readonly schemas: {
      readonly state: PortableSchema<State>;
      readonly observation: PortableSchema<Observation>;
      readonly action: PortableSchema<Action>;
      readonly config: PortableSchema<Config>;
    };
  };

  readonly creation: CreationPolicy<Config>;

  setup(args: SetupArgs<Config>): TransitionEnvelope<State>;

  reduce(
    args: ReduceArgs<State, Action, Config>,
  ): TransitionEnvelope<State>;

  project(
    args: ProjectArgs<State, Action, Config>,
  ): ObservationSlice<Observation>;

  readonly ratings?: RatingCapability<Config>;
  readonly bots?: BotCapability<Action, Observation, Config>;
}
```

Requirements:

- `creation` is server-authoritative and versioned with the game contract.
- Lifecycle events are a tagged reducer input or a separate optional method;
  simple games should inherit explicit safe defaults rather than implement
  ceremony.
- Ratings and bots are capabilities, not six-hook requirements for every game.
- `project` remains mandatory because it is the hidden-information boundary.
- RNG and any clock input remain engine-provided and deterministic.
- The engine validates state and projection output before commit.
- The contract emitter validates the portable schema profile and emits an exact
  digest.

### 8.4 Generated game contract

For every game schema version, generation should produce one manifest:

```json
{
  "game": "example-game",
  "schemaVersion": 2,
  "contractId": "example-game/v2/sha256:...",
  "portableSchemaProfile": "eigen-json-1",
  "schemas": {},
  "creation": {},
  "features": {
    "ratings": true,
    "bots": false,
    "timing": ["untimed", "perAction"]
  },
  "fixtures": []
}
```

The digest covers a canonicalized **client-relevant portable contract**:
payload schemas, creation descriptor, and feature vocabulary. It must not hash
arbitrary TypeScript source code, comments, build paths, or fixture ordering.
A server rules bug fix that preserves every client-visible contract may keep the
same ID; a change that alters what a client must decode, render, configure, or
submit must change it. Record the canonicalization/profile version so the same
contract always hashes identically across machines.

Generate:

- Dart types, codecs, and validators;
- typed creation descriptors;
- exact fixture files plus an ownership manifest;
- a typed `GameDefinition<Observation, Action, Config>` client surface;
- contract capability metadata used in the server/client handshake.

Generation must fail for unsupported schema keywords, transforms, defaults, or
normalizations. Do not silently discard semantics.

### 8.5 Typed Flutter renderer boundary

The desired game-author surface is approximately:

```dart
abstract interface class GameRenderer<Observation, Action, Config> {
  Widget build(
    BuildContext context,
    GameView<Observation, Action, Config> game,
  );
}

abstract interface class GameView<Observation, Action, Config> {
  Config get config;
  Observation get observation;
  List<int> get pendingPlayers;
  GameLifecycle get lifecycle;
  Future<ActionResult> submit(Action action);
  void invalidActionFeedback();
}
```

Infrastructure owns serialization by calling the generated action codec. Game
widgets never submit raw `Map<String, dynamic>` and do not cast config or
observations from `Object`.

Optional local helpers may expose:

- `canSubmit(Action)` for immediate UX;
- `predict(Action)` for optimistic rendering.

They are never authoritative and are not required. Prefer server-projected
legal affordances in `Observation` for games that need them.

### 8.6 Client game coordinator

Build one pure-Dart coordinator per game. It owns:

- the last durable authoritative session;
- connection state and liveness;
- pending mutation journal entries;
- HTTP mutation results;
- WebSocket snapshots;
- gap fetches and validation;
- compatibility and authentication state;
- terminal absorption;
- stale/offline presentation state.

Inputs are serialized through one reducer:

```text
open(local snapshot)
connect/socket session
HTTP mutation accepted/rejected/ambiguous
gap page received
auth changed
protocol decode failed
transport state changed
```

Outputs are a stream/value such as:

```text
GameCoordinatorState
  session: authoritative latest session or null
  renderedFrame: frame currently being animated/rendered
  connection: connecting | live | stale | reconnecting | authFailed | incompatible
  pendingCommands: immutable list
  lastFailure: typed failure or null
```

The coordinator's mutation path is:

1. Validate that a write is allowed in the held state.
2. Generate and durably store a command ID and canonical request before send.
3. Send the HTTP mutation.
4. On a definitive response, reduce the returned session or error.
5. On an ambiguous transport failure, retain the journal entry and reconcile by
   retrying the same ID or observing a newer authoritative session.
6. Remove the journal entry only after a definitive result.

The UI never directly merges a socket and an HTTP result. Riverpod observes the
coordinator; it does not implement its state machine.

## 9. Confirmed defects and implementation specifications

This section is ordered by correctness and dependency, not by repository.
Every item includes the minimum implementation and acceptance work. Add a
failing regression test before changing behavior.

### 9.1 P0: budget timing is associated with the wrong transition

#### Evidence

- `packages/rules/src/contract.ts:77-92` documents an envelope
  `turnSeconds` override.
- `packages/kernel/src/timing.ts:53-101` uses the newly returned envelope value
  to construct the deadline for the next actionable state.
- `packages/kernel/src/commit.ts:266-274` also uses that newly returned value to
  decide whether to debit the bank for the action that just completed.
- `StateRow` records `deadline` and `turnStartedAt` but does not record whether
  the current turn is an override: `packages/kernel/src/commit.ts:54-67`.
- `packages/kernel/test/commit.spec.ts:247-257` tests one transition and thereby
  cements the wrong association.

#### Impact

In a budget game, changing timing modes across consecutive transitions can
credit or debit the wrong turn. This is a fairness and outcome defect, not merely
a display discrepancy.

#### Target behavior

- A turn's persisted timing state says whether it consumes the player's bank.
- Committing an action first charges the prior turn according to that persisted
  state.
- It then computes and persists the timing state for the newly returned pending
  set.
- A finishing action follows a documented policy for charging the completed
  turn; choose and test it explicitly rather than inferring from the next
  envelope.
- A timeout applies to the exact desired deadline and cannot be lost at the
  equality boundary.

#### Data/API changes

Add an engine-owned field to the state row, such as:

```ts
type TurnTiming =
  | { kind: "untimed" }
  | { kind: "perAction"; deadline: number }
  | { kind: "budget"; deadline: number; startedAt: number }
  | { kind: "override"; deadline: number };
```

The exact representation may be normalized into columns, but chargeability must
be durable. Migrate existing development DOs or reset development data with
approval. Do not attempt to infer historical chargeability from the current
deadline.

Resolve the alarm equality edge: expiration currently uses
`deadline + grace < now`, while the alarm is requested at `deadline + grace`.
Either schedule at `+1 ms` or, preferably, make an early alarm reconcile and
re-arm itself for the first instant that is genuinely expired.

#### Required tests

- budget -> budget;
- budget -> override;
- override -> budget;
- override -> override;
- finishing action under both timing modes;
- timeout under both timing modes;
- increment application;
- zero/floor behavior;
- exact deadline, exact deadline plus grace, and one millisecond later;
- multi-transition property tests comparing the bank against a simple reference
  model.

#### Documentation/observability

Rewrite the timing page around “charge the turn that ended; schedule the turn
that begins.” Log/measure alarm lateness and timeout source. Include timing mode
in local inspector output.

#### Rollback

This is an internal storage migration plus kernel fix. Before production, the
clean rollback is to reset development game data and revert the change. After
production, rollback would need dual-read migration support; avoid reaching that
state until the new invariant suite is green.

### 9.2 P0: creation policy is client-authoritative

#### Evidence

- Flutter owns the declared player and timing ranges in
  `lib/core/game/game_creation_spec.dart:1-115`.
- Config-dependent player counts are calculated in
  `lib/core/game/game_module.dart:352-383`.
- The create dialog submits its derived counts/timing/rated value in
  `lib/features/game/presentation/widgets/new_game_dialog.dart:217-249`.
- Server wire validation checks only generic positivity, mutual exclusivity,
  and ordering: `packages/server/src/routes/wire.ts:266-321`.
- The server validates game config and rating eligibility but persists submitted
  min/max/timing values: `packages/server/src/routes/games.ts:162-205`.
- The docs claim timing floors are enforced on both sides:
  `eigen-web/docs/build-a-game/creation-ui.md:42-56`.

#### Impact

A forged or stale client can create a game with unsupported player counts or
clocks, causing rule assumptions to fail, unfair timing, resource abuse, or a
game that can never progress.

#### Target behavior

- Game setup policy is part of the versioned TypeScript `GameDefinition`.
- The client sends a small setup intent containing selected options.
- The server validates and canonicalizes it into stored engine configuration.
- The response contains the canonical setup.
- Generated creation metadata renders the default Flutter UI.
- A custom UI may construct the same typed intent but gains no authority.

#### Data/API changes

Replace `minPlayers`, `maxPlayers`, raw timing values, and the client-computed
rating assertion in the public create request with a typed setup choice. One
possible request:

```json
{
  "commandId": "uuid",
  "contractId": "example/v2/sha256:...",
  "access": "private",
  "config": { "playerCount": 4, "variant": "teams" },
  "timing": { "kind": "perAction", "seconds": 60 },
  "ratingPreference": "rated"
}
```

The server returns canonical values or a structured validation error. A client
preference for casual play is valid even if rating is available; do not describe
`rated` as equality with server eligibility.

Add engine hard limits that apply regardless of the game definition. Validate
before game hooks and before any Durable Object allocation.

#### Required tests

- direct forged requests outside every player/timing/config range;
- config-dependent player counts;
- client metadata and server policy generated from the same contract;
- guest/rated/access combinations;
- old/stale creation metadata;
- upper-bound resource rejection before storage;
- solo/bot creation through the same authoritative path.

#### Documentation/observability

Document the difference between server capability and player preference.
Measure create validation failures by stable reason without logging private
config payloads.

#### Rollback

Treat the create endpoint as a vNext breaking contract. Do not keep both models
indefinitely. During development, the old endpoint may remain behind an explicit
temporary feature flag until the new Flutter flow and examples are green, then
delete it.

### 9.3 P0: mutation identity is optional and dedupe is unsafe

#### Evidence

- `commandId` is optional in `packages/server/src/routes/wire.ts:330-363`.
- Routes mint a fresh UUID when it is absent, for example
  `packages/server/src/routes/games.ts:474-483,575-584`.
- Flutter repository methods accept optional IDs but normal callers omit them:
  `lib/features/game/data/game_repository.dart:188-325` and
  `lib/features/game/presentation/screens/game_screen.dart:347-370`.
- Client retry policy avoids writes because a timed-out POST may have landed:
  `lib/core/api/retry_policy.dart:11-28`.
- The DO looks up a stored response by command ID before operation/actor/payload
  validation: `packages/server/src/do/game-do.ts:131-147`.
- The table stores only `commandId`, response, and time:
  `packages/server/src/do/schema.ts:110-116`.
- Create/create-solo are direct D1 mutations without end-to-end idempotency.

#### Impact

- A lost response cannot be safely retried.
- A user may see an ambiguous or permanently pending result.
- Reusing an ID for a different operation may replay the wrong result.
- Deterministic bot command IDs make cross-principal response replay a plausible
  per-seat hidden-information leak.
- Creation can duplicate after response loss.

#### Target behavior

Every mutation has a required, client-created UUID before its first attempt.
Dedupe identity is the tuple:

```text
(scope, principal, operation, target, commandId, canonicalRequestHash)
```

Behavior:

- exact duplicate: return the stored semantic result;
- same command ID but different fingerprint: `409 idempotencyConflict`;
- caller not authorized for the stored result: never return it;
- retryable infrastructure fault: retry with the same tuple;
- overload or deterministic validation failure: do not retry;
- create: reserve identity and return the same game ID/code on replay.

#### Data/API changes

Make `commandId` required on every mutation schema. Define canonical JSON
encoding and hash rules in one protocol package. Add dedupe columns for
principal/scope, operation, target, and request hash. Store a response format
safe for the same authenticated principal only.

For create, use either:

- a D1 uniqueness record keyed by `(user_id, command_id)` in the same batch as
  the game row; or
- a user-scoped Durable Object responsible for idempotent creation.

Prefer the D1 transaction unless contention/throughput evidence requires
another coordination object.

Decide retention explicitly. Live-game dedupe entries cannot be deleted while
an ambiguous client command may still be retried. If compaction deletes them at
finish, finished-game mutation routes must be terminal and replay must no longer
need them.

#### Required tests

- response lost after commit, followed by retry;
- duplicate delivered concurrently;
- same ID with different action bytes;
- same ID with different kind, game, seat, or actor;
- deterministic bot ID guessed by a human;
- duplicate create returns the same game ID and short code;
- retryable Worker-to-DO failure recreates the stub and retries;
- `.overloaded` and deterministic failures do not retry;
- command journal survives client restart.

#### Documentation/observability

Document outcome certainty and retry rules. Correlate logs by command ID and
request ID but never log full private payloads or access tokens. Count dedupe
hits, fingerprint conflicts, ambiguous client outcomes, and retry classification.

#### Rollback

Introduce the new required field and storage columns together. During a brief
development transition, server-generated IDs may be accepted only on a clearly
versioned legacy endpoint. Delete the legacy behavior before vNext release.

### 9.4 P0: sparse schema support and creation rollout are unsound

#### Evidence

- Flutter explicitly supports sparse version maps and uses membership locally:
  `lib/core/game/game_module.dart:328-350`.
- Join sends only `latestSchemaVersion`:
  `lib/features/game/presentation/screens/lobby_screen.dart:378-388`.
- The server accepts when `game.schemaVersion <= clientSchemaVersion`:
  `packages/server/src/routes/games.ts:323-330`.
- The docs promise rejection before seating:
  `eigen-web/docs/build-a-game/versions.md:57-67`.
- New games always target the highest version bundled into that client, leaving
  no authoritative server-side “currently creatable” version.

#### Impact

- A `{1,3}` client may be seated into unsupported schema `2`.
- A new client can attempt to create vNext before the server supports it.
- An old client can continue creating retired schemas forever.
- Rolling mobile/web/server deployment cannot be reasoned about safely.

#### Target behavior

Add a capabilities document/endpoint containing:

```json
{
  "protocol": { "major": 1, "features": ["session-v2", "socket-ticket-v1"] },
  "games": {
    "example": {
      "creatableContractId": "example/v3/sha256:...",
      "readableContractIds": ["example/v1/...", "example/v2/...", "example/v3/..."],
      "writableContractIds": ["example/v2/...", "example/v3/..."]
    }
  },
  "minimumClient": null
}
```

The client sends or has already registered its exact supported contract IDs.
Before seating, the server checks exact membership. Before create, it requires
the current server-advertised creatable contract. Keep read/replay and
write/active lifetimes distinct.

#### Required tests

- sparse `{1,3}` rejects `2`;
- old client cannot create retired version;
- client-first and server-first staged deployments;
- readable-but-not-writable historical version;
- unknown protocol feature and protocol major;
- same integer schema with a mismatched digest;
- web hot reload and installed mobile binary behavior.

#### Documentation/observability

Replace maximum-version language everywhere. Publish a rollout recipe with
capability intersections. Measure rejections by protocol/contract without
logging user payloads.

#### Rollback

Capabilities should be additive before the legacy scalar is removed. Once all
vNext reference clients use exact membership, delete scalar negotiation rather
than supporting both permanently.

### 9.5 P0: client command and realtime paths do not converge

#### Evidence

- `submitAction` returns a complete session, but the screen discards it and
  waits for the socket: `lib/features/game/presentation/screens/game_screen.dart:347-370`.
- `GameRepository.sessions` accepts an injected response stream, but
  `gameSessionProvider` does not provide one:
  `lib/features/game/data/game_repository.dart:345-435` and
  `lib/features/game/providers/game_providers.dart:151-166`.
- `joinByCode` performs a mutation inside a provider subject to general
  transport retry: `lib/features/game/providers/game_providers.dart:303-317`.
- The socket swallows all failures and reconnects forever, with no jitter or
  permanent failure state: `lib/core/api/game_socket.dart:76-124`.
- Decode failures are logged and skipped while the connection appears usable:
  `lib/core/api/game_socket.dart:136-153`.
- `GameSession.supersededBy` accepts any higher sequence before terminality:
  `lib/core/game/game_session.dart:64-76`.

#### Impact

- A successful command may leave the UI stale or pending if its socket copy is
  delayed or lost.
- A provider retry can repeat a mutation without stable identity.
- Cold offline can spin forever; incompatible messages can be dropped forever.
- A delayed higher-sequence active snapshot can resurrect a terminal game once
  response injection is wired.

#### Target behavior

Implement the coordinator from section 8.6 before splitting packages. It must:

- reduce HTTP and socket sessions using the same ordering rules;
- make terminal state absorbing against non-terminal snapshots;
- expose typed connection and compatibility states;
- use full-jitter exponential reconnect backoff with app/network lifecycle
  awareness;
- treat malformed/incompatible session data as `incompatible`, not as a
  skipped message;
- validate recovered frame ranges for completeness, contiguity, correct game,
  correct seat/viewer, and expected final version;
- persist the latest authoritative session and pending mutations;
- show stale cached state and disable unsupported writes when offline.

Avoid treating `connectivity_plus` as proof of Internet reachability. Socket
liveness should come from successful handshakes/snapshots and a bounded stale
timer or protocol heartbeat.

#### Required tests

Build a deterministic model test that permutes:

- response before socket;
- socket before response;
- duplicate copies;
- response loss;
- reconnect snapshot with no gap;
- multi-frame gap;
- incomplete/out-of-order gap response;
- terminal response racing delayed active socket state;
- process restart with pending mutation;
- auth expiry;
- unknown protocol/session shape;
- cancellation/disposal during every asynchronous stage.

#### Documentation/observability

Document connection states and outcome certainty in user-facing terms. Measure
time stale, reconnect attempts, gap sizes, decode incompatibility, journal age,
and commands confirmed by socket rather than direct response.

#### Rollback

Introduce the coordinator behind the existing providers, then make providers
thin adapters. Do not split packages and duplicate old state logic in parallel.
Once all screens consume coordinator state, delete the legacy session merger.

### 9.6 P0: alarms and finish outbox lack closed-loop recovery

#### Evidence

- A transition/dedupe/outbox commit completes before `setAlarm` or
  `deleteAlarm`: `packages/server/src/do/game-do.ts:397-450`.
- A retry of the same command returns the stored response before rearming:
  `packages/server/src/do/game-do.ts:131-136`.
- Finish failure retains an outbox and logs that an admin can re-poke:
  `packages/server/src/do/game-do.ts:653-669`.
- `repokeFinish()` exists at `packages/server/src/do/game-do.ts:713-724`, but a
  repository-wide search found no route, cron, queue, or admin caller outside a
  test and protocol declaration.
- D1 summary/roster mirrors use bounded transient retries but no complete
  reconciliation scan.

#### Impact

- A timed game may commit a new deadline without an alarm and never time out.
- A finished game may remain active/stale in D1, omit ratings, retain its
  outbox/live frames/commands indefinitely, and require code-level intervention.
- D1 list badges and lobbies can remain stale after retry exhaustion.

#### Target behavior

The desired alarm and pending finish work are durable state, not transient side
effects.

Recommended design:

1. Store desired deadline/alarm generation atomically with the transition.
2. After commit, call a single idempotent `reconcileAlarm()`.
3. Also call it on activation, duplicate command, session open, and any alarm
   event that fires early or for an obsolete generation.
4. When a game finishes, repurpose the DO alarm for finish-outbox retry with
   bounded exponential backoff and jitter.
5. Keep D1 finish apply idempotent by `finishId`.
6. Clear the outbox only after D1 apply and any durable follow-up transition are
   committed.
7. Add a protected operator repair/inspect endpoint or CLI.
8. Add a bounded scheduled reconciliation job for stale D1 read models and
   orphaned outboxes as a backstop, not the primary mechanism.

Do not introduce Queues or Workflows unless their operational value exceeds the
simplicity of the per-game alarm. Re-read current Cloudflare guidance before
choosing.

#### Required tests

- injected `setAlarm` failure after commit;
- object reset between commit and alarm reconciliation;
- duplicate command repairs missing alarm;
- alarm fires at/before/after desired boundary;
- old alarm races a newer transition;
- transient and deterministic D1 finish failures;
- process/object restart with retained outbox;
- finish retry applies ratings exactly once;
- reconciliation after retries are exhausted;
- stale D1 summary repaired without a new player move.

#### Documentation/observability

Document actual automatic recovery rather than a hypothetical admin re-poke.
Expose gauges/alerts for desired-vs-actual alarm drift, alarm lateness, outbox
age, retry count, and D1 mirror lag.

#### Rollback

Keep the existing finish ID and idempotent D1 apply as the stable seam. The new
alarm/reconciler can be disabled while the protected manual repair path remains
available. Never roll back by deleting a pending outbox.

### 9.7 P0: authentication tokens and unknown IDs create avoidable exposure

#### Evidence

- Flutter places the complete Firebase ID token in the WebSocket query string:
  `lib/core/api/game_socket.dart:9-33,60-62`.
- Server auth explicitly accepts the `?token=` fallback:
  `packages/server/src/engine.ts:239-255`.
- Socket routing preflights D1 before waking a DO, but action, forfeit,
  leave/cancel/start, and session paths can directly create a stub for an
  arbitrary ID.
- Stub lookup uses `idFromName(gameId)`:
  `packages/server/src/engine.ts:428-435`.
- Every new DO runs SQLite migration during construction:
  `packages/server/src/do/game-do.ts:118-125`.
- Missing D1 initialization returns `unknownGame` only after the empty DO has
  been materialized: `packages/server/src/do/game-do.ts:1023-1061`.

#### Impact

- Query URLs commonly enter access logs, proxies, crash/telemetry reports,
  browser tooling, and copied diagnostics. A bearer identity token should not be
  there.
- An authenticated attacker can generate random IDs and cause migrations and
  storage allocation for many empty DOs. This is a cost/abuse issue, not a
  demonstrated data authorization bypass.

#### Target behavior: socket ticket

Add an authenticated HTTPS endpoint that mints a short-lived opaque ticket:

```text
POST /games/{gameId}/socket-ticket
Authorization: Bearer <identity token>

201 {
  ticket: <high-entropy opaque value>,
  expiresAt: <epoch ms>,
  socketUrl: "wss://.../socket?ticket=..."
}
```

The ticket is scoped to principal, game, protocol capability, and a short
expiry. Prefer one-time consumption. Store only a hash if persisted. Redact it
from logs and errors. The DO/Worker derives the principal from the validated
ticket, not from client-supplied forwarding headers.

#### Target behavior: valid game handles

Before allocating a stub for an untrusted identifier, prove it names a known
game. Options:

- validate canonical UUID syntax and read the D1 registry;
- issue a signed opaque game capability/handle at creation;
- use an engine-maintained initialized-ID registry.

The simplest initial implementation is a canonical UUID check plus a D1
existence/access preflight for routes that currently go straight to a stub.
Avoid a D1 read on the hot action path only if a signed handle or equivalent
provides the same protection. Lazy-migrate only known initialized games.

#### Required tests

- token never appears in socket URL, server logs, Flutter logs, exception text,
  analytics, or traces;
- expired, replayed, wrong-game, and wrong-user ticket;
- origin validation on browser socket upgrades;
- many random IDs leave no initialized DO data;
- known-game hot path remains authorized and bounded;
- forged `x-eigen-*` headers remain ignored.

#### Rollback

Support tickets before removing query identity tokens. Once all vNext clients
use tickets, delete the token fallback. Never log both during migration.

### 9.8 P0/P1: abuse and resource budgets are incomplete

#### Evidence

- Join codes are six characters from a 31-character alphabet:
  `packages/server/src/routes/games.ts:126-136`.
- Join-by-code has no dedicated limiter:
  `packages/server/src/routes/games.ts:366-381`.
- Current limiter names cover only avatar upload, game create, friend request,
  and user search: `packages/server/src/rate-limit.ts:28-39`.
- `action.data` is `unknown`, create values have no meaningful upper bounds,
  and there are no central game-state/observation/history byte budgets.
- Frame range fetch can project up to 1,000 versions in one call:
  `packages/server/src/routes/games.ts:511-545`.

#### Target behavior

Define a centralized `EngineLimits` with conservative production defaults and
host overrides bounded by safe absolute ceilings. Include at least:

- request body and action bytes;
- config, state, and per-seat observation bytes;
- seats per game;
- clock min/max and increment max;
- bots per game;
- transitions/retained history policy;
- replay page count and response-byte cap;
- player batch/list page sizes;
- sockets per principal/game where meaningful;
- create/join/action/social/avatar rates.

Validate byte/shape limits before expensive parsing, hooks, projection, storage,
or DO allocation. Return stable `413`/`422`/`429` errors with request IDs and
`Retry-After` where appropriate.

Join-by-code needs defense in depth keyed by a privacy-preserving combination of
account and network/device signals. Cloudflare rate-limit bindings are abuse
dampeners, not exact accounting. Use uniform non-enumerating failures and make
safe production bindings part of the scaffold rather than an optional footnote.

#### Required tests

- brute-force join code attempts;
- shared-IP legitimate users;
- missing rate-limit binding behavior in development versus production config;
- every size/count/time limit at `limit-1`, `limit`, and `limit+1`;
- large projection/replay cannot exceed response-byte budget;
- overload sheds work rather than retrying it.

#### Documentation/observability

Publish application limits separately from Cloudflare platform limits. Measure
rejections and top-level sizes without logging private payload contents.

### 9.9 P1: JSON Schema semantics are silently lost in Dart

#### Evidence

- The quickstart adds `.max(3)` and claims the app rejects `amount: 4`:
  `eigen-web/docs/getting-started/quickstart.md:204-224`.
- The Dart generator emits fields and primitive types but ignores numeric
  bounds, string patterns/lengths, and other keywords:
  `lib/src/codegen/payload_generator.dart:173-273`.
- The server contract emitter serializes the schema but does not reject an
  unsupported portable subset:
  `packages/testkit/src/game-contract.ts:72-79,125-138`.
- Type-level “same input/output” does not prevent same-type transforms,
  defaults, stripping, or normalization.
- Generation writes the expected fixture files but does not remove old ones;
  check mode verifies only names in the current contract while the test loader
  discovers every JSON file in the directory:
  `lib/src/codegen/payload_generator.dart:54-81`,
  `bin/generate_payloads.dart:22-47`, and
  `lib/testing/twin_fixtures.dart:161-179`.

#### Target behavior

Define `eigen-json-1`, an explicit portable JSON Schema profile. Initially
support only what is required by the reference games, for example:

- object with explicit properties and required fields;
- closed or deliberately open object behavior;
- string, integer, number, boolean, null;
- arrays with homogeneous items and explicit size limits;
- string enums;
- `$ref` to named definitions;
- nullable unions;
- numeric min/max and string/array min/max where generated validators implement
  them.

Explicitly reject or postpone:

- transforms and preprocessors;
- defaults or coercions;
- heterogeneous tuples unless fully supported;
- ambiguous unions;
- unsupported regex dialects;
- optional-plus-nullable if the generated encoder cannot distinguish absent
  from explicit null.

Contract generation must fail with a path and unsupported keyword. Generate
equivalent Dart validation or state clearly that a field is only shape-decoded.
The recommended choice is real validation for every supported constraint.

#### Required tests

- golden schema profile;
- each supported constraint accepted/rejected identically in TypeScript and
  Dart;
- unsupported keyword fails contract emission;
- transform/default/coercion rejection;
- absent versus explicit null round-trip;
- unknown object fields according to the declared policy;
- fuzzed malformed payloads;
- exact generated-file manifest removes stale fixture files.

#### Documentation/observability

Publish the profile as a small normative reference. Update the quickstart only
after its promise is executable.

### 9.10 P1: mandatory Dart business-rule twins should be removed

#### Evidence

- Server rules require authoritative hooks including ratings and bot policy:
  `packages/rules/src/contract.ts:264-319`.
- Dart requires local legality, preview, rating pool, and bot policy:
  `lib/core/game/game_module.dart:199-309`.
- Docs say fixture examples make agreement “enforceable”:
  `eigen-web/docs/build-a-game/the-contract.md:45-56`.
- Fixtures test authored cases, not equivalence across all states.
- `previewAction` may return `null` and skip comparison, and infrastructure does
  not call it automatically: `lib/testing/twin_fixtures.dart:341-416` and
  `lib/core/game/game_module.dart:258-275`.

#### Target behavior

- TypeScript remains the sole source of legality, rating, and bot policy.
- Generate typed codecs, creation metadata, and simple declarative affordances.
- A game may include legal action affordances in its observation.
- Optional Dart `canSubmit`/`predict` helpers are presentation accelerators only
  and carry no correctness claim.
- Fixtures remain useful for examples, codecs, and optional predictor behavior,
  but docs must not claim they prove full equivalence.

Do not build a portable rules evaluator unless real latency measurements across
representative deployments prove server round trips are inadequate. For
human-speed turn-based games, immediate tap feedback and a pending visual are
usually sufficient.

#### Required tests

- reference games compile and work without authoritative Dart predicates;
- server-projected affordances never reveal hidden information;
- optional predictor disagreement always reconciles to server state;
- bot/rating/create screens use server/generated capabilities.

### 9.11 P1: replay fidelity and data privacy are underspecified

#### Evidence

- Transitions persist full opaque state and action:
  `packages/server/src/do/schema.ts:75-92`.
- Live per-seat frames are deleted after finish:
  `packages/server/src/do/schema.ts:94-107` and finish compaction in
  `packages/server/src/do/game-do.ts:672-705`.
- Replay re-runs the versioned `computeObservation` over historical state:
  `eigen-web/docs/build-a-game/versions.md:45-55`.
- Account deletion anonymizes engine-owned D1 identities, but opaque game state
  is outside the engine's knowledge:
  `packages/server/src/lifecycle/purge.ts:75-107`.

#### Impact

- Historical replay output can change when projector behavior changes even if
  stored transitions are immutable.
- Old projection code must live for as long as replay, which may be forever.
- A game author can place personal data in opaque state that account deletion
  cannot discover or redact.
- Full state per transition has a real storage/retention cost, but speculative
  R2 architecture adds complexity before usage is known.

#### Recommended target

Use an immutable transition ledger, but retain the exact per-seat frames that
were delivered and generate an explicit public replay projection at finish.
This makes replay byte-stable and decouples it from future executable code.

Store:

- authoritative full transition state for audit/recovery according to retention
  policy;
- exact participant frames;
- zero or one public replay frame per transition if public replay is enabled;
- contract ID and protocol version on every artifact.

State in documentation that this is a snapshot-based immutable transition
ledger, not pure event sourcing: the reducer need not be replayed to reconstruct
current state.

Initially forbid PII and free-form chat/user-authored personal content in opaque
game state. If a product later needs it, add a deliberate redaction/export
contract and data classification rather than assuming generic JSON deletion is
possible.

#### Required tests

- replay bytes remain stable across a deployment that changes projector code;
- participant and public replay receive the correct visibility;
- deleted accounts are anonymized without exposing another seat;
- retention/export/delete policies apply to DO and D1 data;
- large history paging stays within byte limits;
- old readable contract retirement is consistent with retained artifacts.

#### Owner gate and rollback

The owner must approve exact-frame retention and its default duration before
schema changes. Do not implement R2 cold tier in this work unless measurement
and a separate decision justify it.

### 9.12 P1: error, auth, and connection semantics lose required information

#### Evidence

- Flutter error conversion retains message and optional engine code but loses
  HTTP status, request ID, `Retry-After`, retriability, and outcome certainty:
  `lib/core/api/engine_call.dart` and `lib/core/errors/engine_exception.dart`.
- The auth interceptor documents 401 handling, but review found no complete
  401 refresh/sign-out flow in `lib/`.
- Current-user state observes an ID rather than the complete auth value, so an
  anonymous-to-registered upgrade with the same ID can remain stale:
  `lib/features/auth/providers/auth_providers.dart`.
- Local cleanup occurs before ordinary credential sign-out, so a cleanup
  failure can prevent sign-out.

#### Target behavior

Define a typed failure model in the pure Dart client:

```text
unauthenticated
forbidden
notFound
conflict
validation
rateLimited(retryAt)
server(requestId)
transportUnknown(commandId?)
protocolIncompatible(details)
cancelled
```

Every failure records whether a mutation outcome is definitive or unknown.
Retain safe response metadata and a server-generated request ID. Refresh an auth
token at most once on 401 for a safe/idempotent request; a persistent 401 enters
an explicit expired-session state. Watch the complete auth state. Make local
cleanup best effort so credentials can always be cleared.

#### Required tests

- expired token -> one refresh -> success;
- persistent 401;
- guest upgrade with the same principal ID;
- 429 with parsed `Retry-After`;
- transport loss before versus after server commit;
- cleanup storage failure during sign-out;
- no error object leaks credentials or private payloads.

### 9.13 P1: the advertised Android release path is not exercised

#### Evidence

- `eigen_flutter` declares an Android plugin in `pubspec.yaml`.
- The package CI checks tests and web builds, but does not build a real Android
  application bundle.
- The checked-in example advertises an app-bundle command but historically did
  not contain a complete Android application fixture.

#### Target behavior

- The scaffolder emits a complete Android application.
- CI builds a release AAB from a freshly scaffolded project.
- An emulator smoke test covers launch, local auth, create/join/action, reconnect,
  and deep link.
- Firebase emulator tests cover auth where the adapter is enabled.
- A documented manual or scheduled physical-device smoke test covers push token
  registration and delivery.
- Either make iOS first class with equivalent gates or explicitly document it as
  unsupported for vNext.

### 9.14 P1/P2: additional client correctness and product gaps

These should not delay the server invariants, but they belong in the vNext
program rather than an indefinite backlog:

- Paginate active games; the reviewed client loaded one default-sized page and
  could silently omit later active games.
- Use opaque stable composite cursors such as `(timestamp,id)`; timestamp-only
  cursors can skip tied rows. Revalidate this against the now-current pagination
  implementation before changing it.
- Page/stream replay rather than downloading all frames at once.
- Refresh relevant read models on app resume and notification navigation.
- Hold a pending notification route until the router is ready.
- Decode login redirects once and allow only internal, normalized routes.
- Test Firebase installation/token callbacks on real devices; do not infer
  registration completion merely from requesting an installation ID.
- Add localization; the current full shell is English-only.
- Expand branding only in the optional shell: logo, illustrations, legal links,
  auth choices, feature flags, navigation extension, and analytics consent.
- Add semantics, keyboard, 200% text scale, screen-reader, narrow phone, tablet,
  dark-mode, and golden tests.
- Test minimum-supported and current-stable Flutter/Dart versions.
- Remove stale README/package-version examples and generated-client comments.

### 9.15 P1: Firebase and the full product shell are mandatory core dependencies

#### Evidence

- `runEngineApp` requires Firebase options and a background messaging handler,
  initializes Firebase, Analytics, Crashlytics, Messaging, Riverpod, and the
  whole app: `lib/app_runner.dart:20-121`.
- The package owns `MaterialApp.router`, so a consuming game does not own the
  normal Flutter composition root.
- `EngineConfig` requires a Google web client ID and requires a VAPID key on
  web even when a game does not want Google sign-in or push:
  `lib/core/config/app_config.dart:38-64,98-127`.
- One package dependency brings routing, social/profile UI, image tooling,
  update/review code, Firebase integrations, persistence, and the shell.
- On the server, authenticated middleware validates Firebase Admin
  configuration at the entire authenticated route boundary:
  `packages/server/src/engine.ts:239-255`.

#### Impact

The fastest default path is also the only path. A simple local, guest-only,
push-free game or an existing app embedding Eigen must accept unrelated product
and credential requirements. This inflates dependencies, startup failure modes,
customization pressure, and test surface.

#### Target behavior

Implement the pure-Dart client, Flutter adapter, optional shell, and Firebase
adapter boundaries described in sections 8 and 12. The default scaffold may
choose the shell and Firebase production preset, but local play uses a local
identity adapter and optional services remain disabled until configured.

Server module configuration should distinguish token verification from
Firebase Admin effects and should not require push/admin credentials on routes
that do not use them. Account deletion must clearly report when an enabled auth
adapter lacks administrative deletion capability.

#### Required tests

- headless pure-Dart use with no Flutter/Firebase dependency;
- embedding Flutter app owns `MaterialApp` and router;
- local first move with no Firebase config;
- shell with Firebase adapter retains auth/push behavior;
- push/social/avatar/ratings disabled independently;
- missing optional credentials fail only the enabled capability, not unrelated
  authenticated play.

## 10. Package and repository implementation

### 10.1 Perform consolidation as a behavior-preserving change

Repository consolidation should happen early enough that semantic contract
changes become atomic, but it must not be mixed with those changes.

Suggested procedure after owner approval:

1. Create the destination repository and write its workspace/build conventions.
2. Import the three histories using `git subtree`, history-preserving filters, or
   another documented method chosen by the owner.
3. Preserve package names and behavior initially.
4. Recreate CI with the same lint, typecheck, tests, builds, generated drift
   checks, and publish dry runs.
5. Prove all baseline commands pass in the new layout.
6. Record a platform manifest mapping the existing engine, Dart API, Flutter,
   scaffolder, and docs versions.
7. Only then begin the semantic work packages.
8. Archive or redirect old remotes only after vNext packages/docs publish and
   the owner authorizes it.

Do not squash history merely for convenience. Do not rewrite remotes or close
open work without explicit coordination.

### 10.2 Separate logical packages in dependency order

Recommended extraction order:

1. Protocol schemas, stable errors, capability manifest, canonical JSON/hash
   rules, and OpenAPI generation.
2. Pure Dart generated protocol package.
3. Pure Dart transport/coordinator package extracted from Flutter behavior.
4. Flutter/Riverpod adapter package.
5. Optional Firebase adapter.
6. Optional full app shell.
7. Game code generator as a development-only package/executable.

Avoid a dependency explosion. For the first vNext release, some logical modules
may publish together. What matters is that a headless consumer does not pull the
full shell and integrations.

### 10.3 Version axes

Do not use the npm engine package version as the wire protocol version. Define:

| Axis | Meaning | Example |
| --- | --- | --- |
| Package SemVer | API of one published package | `@eigen/server 1.2.0` |
| Protocol major/features | HTTP/socket semantic compatibility | `protocol 1`, `socket-ticket-v1` |
| Game contract ID | Exact schema/creation/projection contract | `rps/v2/sha256:...` |
| Storage migration | Internal D1/DO schema | D1 `17`, DO `8` |
| Platform release manifest | Exact tested package/docs/tool set | `platform 2026.1` or a lock manifest |

The scaffolder pins an exact tested platform set and lockfile. It should not
choose independently compatible caret ranges and hope their APIs align.

Package SemVer may move for internal/public API changes while the protocol stays
the same. A protocol feature is additive only if old clients can safely ignore
it. Installed mobile clients make server backward compatibility an operational
fact, so breaking protocol changes require an explicit capability window.

### 10.4 Generated artifacts

Choose one reproducible source flow:

```text
normative protocol/game definition
  -> OpenAPI + capability manifest + game contract
  -> TypeScript and Dart generated models/validators
  -> examples and reference docs
  -> llms surfaces
```

Rules:

- generation is deterministic;
- generated directories have ownership manifests and exact file-set checks;
- stale generated files fail CI;
- generators run in isolated temporary directories for drift checks;
- published docs are built from the same revision as the contract;
- generated source includes generator/profile version and contract digest;
- no workflow reaches into an independently moving sibling checkout to publish
  a release.

## 11. Server target design details

### 11.1 Durable Object responsibilities

The game DO owns only per-game integrity:

- canonical immutable game setup copied from the creation record;
- roster and lifecycle;
- authoritative transition reducer;
- timing state and desired alarm;
- exact per-viewer frames and replay artifacts according to policy;
- idempotency/dedupe fingerprints and results;
- finish outbox;
- hibernatable socket attachments;
- session projection and bounded frame paging.

It should not own global social policy, cross-game searches, credentials,
marketing pages, or arbitrary module composition.

Every public DO method must be idempotent or explicitly read-only. Prefer a
small RPC surface such as:

```text
initialize(canonicalCreateRecord)
execute(authenticatedCommand)
session(viewer)
frames(viewer, cursor, byteLimit)
openSocket(validatedTicketContext)
reconcile()
inspect(operatorContext)
```

Initialization should be explicit. Do not construct/migrate a persistent
database for a random unknown game identifier. Follow current Cloudflare
guidance around constructor initialization, input/output gates, non-storage
awaits, alarms, hibernation, and transient errors.

### 11.2 D1 responsibilities

D1 remains:

- game-ID registry and canonical creation reservation;
- queryable game summaries/read model;
- users and optional identity profile data;
- optional social module;
- optional bot registry;
- optional ratings and history;
- device registrations for optional push;
- platform/contract inventory and operational indexes where useful.

D1 never decides whether a live action is legal or what state/version wins. Its
mirrors are allowed to be briefly stale but must have observable bounded repair.

### 11.3 Mutation route flow

The target hot action path:

```text
request limits and canonical decoding
  -> authentication / principal
  -> idempotency identity validation
  -> prove game handle is initialized
  -> Durable Object execute(command fingerprint + intent)
  -> classify retryable DO infrastructure error
  -> bounded same-ID retry if safe
  -> return complete viewer session + request ID
```

Do not perform game policy in both the Worker and DO. The edge owns generic
authentication, abuse, request shape, access gates that depend on global data,
and target validation. The DO owns per-game roster/status/version/rules checks.

### 11.4 Canonical idempotency model

Define the canonical request bytes once. Recommended properties:

- UTF-8 canonical JSON;
- lexicographically sorted object keys;
- integers preserved exactly;
- reject non-finite numbers;
- distinguish absent and null where the schema does;
- exclude transport-only metadata such as trace headers;
- include protocol operation, target game, actor scope, seat, expected version,
  and payload.

Hash with SHA-256 and store the versioned hash algorithm. The client does not
need to calculate the authoritative fingerprint; it sends the stable ID, while
the server canonicalizes and fingerprints. Including the algorithm version
avoids future ambiguity.

The stored response must be safe to replay only to the same authorization
scope. Never store a raw identity token. Consider encrypting or minimizing
long-lived response data if dedupe retention extends beyond live play.

### 11.5 Socket protocol

Keep the stream small and complete. A vNext server message can remain a full
per-viewer session:

```json
{
  "type": "session",
  "protocol": 1,
  "seq": 42,
  "gameId": "...",
  "contractId": "...",
  "lifecycle": "active",
  "players": [],
  "frame": {
    "version": 12,
    "observation": {},
    "pendingPlayers": [1],
    "timing": {}
  }
}
```

The command response carries the same session model. The socket is still
server-to-client only; client commands remain HTTP. Add only the minimum
protocol-level liveness mechanism needed to distinguish a half-open stale
connection. A periodic server snapshot, ping/pong with a stale timer, or the
platform's automatic response may suffice; choose after measuring and reading
current platform behavior.

Do not silently add heterogeneous event types that force clients to reconstruct
truth. If a control message is unavoidable, make it versioned and explicit.

### 11.6 Readiness and operator surface

Keep public `/health` as cheap liveness. Add a protected readiness/diagnostic
surface that can verify, with strict cost and auth controls:

- required configuration present;
- D1 query/migration version;
- DO class binding and a dedicated synthetic diagnostic object;
- current protocol/platform version;
- optional adapters and their configuration state;
- oldest pending finish outbox/read-model drift from operational indexes.

Build a CLI or protected admin API for:

- inspect game metadata, latest transition, desired alarm, actual alarm if
  available, and outbox;
- idempotently reconcile one game;
- scan/reconcile a bounded batch;
- export one game/user;
- exercise deletion in a non-production drill;
- show contract/version inventory.

All operator actions need authentication, authorization, audit logs, rate
limits, and dry-run where meaningful.

### 11.7 Classify post-commit effects

Do not apply one delivery guarantee to every side effect. Classify them:

- **Truth-critical durable work**: desired alarm, finish/rating apply, and any
  read-model state required for lifecycle/repair. These need an outbox or durable
  desired state plus automatic reconciliation.
- **Operationally repairable display work**: D1 lobby/turn mirrors. These use
  idempotent bounded retry plus reconciliation and visible lag metrics.
- **Best-effort notifications**: push and analytics. They may fail without
  changing game truth and should not delay a command response.
- **Bot wakeups**: deterministic/version-bound delivery with a documented retry
  policy; a deadline remains the safety outcome if a bot never acts.

The kernel can name effects, but the host assigns their delivery class. Never
make correctness depend on an unawaited best-effort promise merely because it is
usually fast.

## 12. Client and Flutter target design details

### 12.1 Pure Dart client

The pure Dart package owns:

- generated protocol models and game contract codecs;
- `EngineTransport` interfaces for HTTP and realtime;
- injectable `AuthTokenProvider` and socket-ticket acquisition;
- `GameCoordinator` and deterministic reducer;
- `CommandJournal` and `GameLocalStore` interfaces;
- typed errors and request metadata;
- server-clock offset model;
- reconnect policy and lifecycle inputs;
- no UI or platform plugin imports.

Choose a stable local SQLite implementation in the Flutter adapter or a
separate storage adapter. The core accepts an interface and an in-memory fake so
all coordinator tests run without Flutter.

Persist initially:

- latest authoritative session per game;
- pending commands and their state;
- minimal summary/replay metadata needed for honest cold offline UI;
- protocol/contract metadata required to decode the cache.

Do not persist every provider as a substitute for a domain read model.

### 12.2 Flutter adapter

The Flutter package owns:

- Riverpod providers wrapping core coordinators/repositories;
- application lifecycle and network hints;
- typed game-renderer bridge;
- shared game/lobby/timing/avatar widgets that are broadly reusable;
- accessibility and adaptive component primitives;
- haptic/display feedback interfaces.

It must not create the root `MaterialApp`, own a global router, or force
Firebase. An embedding app controls its composition root.

### 12.3 Optional shell

The shell is a reference/default application that may own:

- `MaterialApp.router` and navigation;
- sign-in/onboarding;
- home/lobby/history/replay;
- profile/social/settings;
- branding/theme/localization;
- notification permission UX;
- in-app update/review surfaces;
- legal/marketing links.

Every major capability has a module/adapter boundary. A game can use the shell
unchanged for speed or build its own application around the same client.

### 12.4 Firebase adapter

The adapter implements:

- identity token provider and auth state;
- optional anonymous/Google/Apple flows;
- optional FCM registration and push routing;
- optional Analytics and Crashlytics sinks.

Analytics/crash collection must respect explicit consent and environment
policy; do not automatically enable product telemetry solely because the build
is release mode. A no-op/local identity adapter supports development and tests.

### 12.5 Connection and offline UX

The UI must distinguish:

- no cached state and connecting;
- live/current;
- reconnecting with a still-fresh view;
- stale cached view;
- authentication expired;
- protocol/game contract incompatible;
- definitive command rejection;
- unknown command outcome pending reconciliation.

Cold offline shows the last board if decodable, clearly marked stale, with writes
disabled. A manual refresh/reconnect is available. Do not promise offline play
unless the entire version/idempotency workflow supports it.

## 13. Observability and operational requirements

### 13.1 Structured context

Every request and game command should carry safe structured context:

```text
requestId
commandId (if any)
operation
gameId (if authorized/safe)
principal class, not raw credential
protocol version
contract ID
result code
attempt and retry classification
latency
```

Never log identity tokens, socket tickets, full private actions, full state,
observations, service credentials, bot secrets, or unbounded error causes.

### 13.2 Minimum metrics

- HTTP and DO command count/latency/result by operation;
- idempotency hit/conflict counts;
- DO retryable, overloaded, and reset errors;
- transition commit latency and state/frame byte sizes;
- alarm desired/actual reconciliation and lateness;
- timeout count and clock mode;
- finish outbox count, age, retry, and recovery;
- D1 mirror lag and repair count;
- socket connects, duration, reconnects, ticket failures, and stale time;
- client compatibility rejections by protocol/contract;
- gap fetch size/failure;
- rate/size limit rejection;
- account deletion duration/failure stage;
- reference-game synthetic journey status.

Define initial service objectives only after representative measurements, but
the data must exist before production.

### 13.3 Runbooks and drills

Write and exercise runbooks for:

- stuck finish outbox;
- missing/late deadline alarm;
- stale D1 lobby or “your turn” state;
- incompatible client rollout;
- Firebase/JWKS/FCM outage;
- D1 or DO transient errors/overload;
- abusive join-code traffic;
- account deletion partial failure;
- backup/export/restore;
- bad server deployment rollback.

Recovery tools must be idempotent and testable in local/staging environments.

## 14. Documentation corrections and target information architecture

### 14.1 Material statements to correct

After the implementation contract is finalized, correct at least:

- `docs/build-a-game/creation-ui.md`: it currently says timing floors are
  enforced on both sides, while setup constraints live primarily in Flutter.
- `docs/build-a-game/versions.md`: it promises exact unsupported-schema
  rejection while the current handshake sends only a maximum integer.
- `docs/getting-started/quickstart.md`: it claims generated Dart rejects a
  `.max(3)` constraint that the generator currently ignores.
- `docs/build-a-game/the-contract.md`: it overstates finite twin fixtures as
  proof of cross-language business-rule equivalence.
- `docs/build-a-game/creation-ui.md`: it describes rated as an equality
  assertion, while casual is a valid preference when rating is available.
- `docs/reference/compatibility.md`: its generated table says 0.3.x is current,
  while later authored prose says only 0.2.x is served.

Do not merely edit prose to hide defects. Make implementation and normative
contract agree, then regenerate docs and add checks for authored version claims.

### 14.2 vNext docs structure

Keep the strong task-first style. Recommended primary path:

1. What Eigen is and is not.
2. Scaffold and run locally without cloud credentials.
3. Build one authoritative TypeScript game definition.
4. Generate the portable contract.
5. Build one typed Flutter renderer.
6. Test setup, actions, hidden information, clocks, replay, and compatibility.
7. Enable optional Firebase, push, ratings, bots, social, avatars, and shell
   modules as needed.
8. Deploy Worker/web/Android.
9. Operate, monitor, repair, export, and delete.

Every task page should state which side is authoritative and which artifacts are
generated. Separate normative protocol/profile references from conceptual prose.

### 14.3 Documentation release gates

- OpenAPI and capability manifest match source.
- Generated Dart APIs and game payloads have no drift or stale files.
- TypeDoc/Dartdoc links resolve.
- `llms.txt` and `llms-full.txt` are emitted and contain the current contract.
- Code samples compile in reference projects.
- Current version prose is derived or checked, not maintained in multiple
  handwritten places.
- Published docs identify the exact platform release and protocol line.

## 15. End-to-end execution plan

This order is a dependency graph, not a schedule. Do not parallelize two steps
that define the same contract. Each work package should leave the repository
green and update source, generated artifacts, examples, and docs together.

### Phase 0: authorize and capture the baseline

#### Deliverables

- [ ] Owner records whether the product remains per-game/self-hosted.
- [ ] Owner records replay retention, PII policy, auth preset, application
      budgets, and monorepo history strategy.
- [ ] Current branches, SHAs, worktree state, package versions, and deployed
      environments are captured.
- [ ] All existing lint/typecheck/test/build/generation commands pass or their
      unrelated failures are documented.
- [ ] Current API, D1 schema, DO schema, generated clients, and live docs are
      archived as review artifacts.
- [ ] A vNext branch/repository and decision-log location are selected.

#### Exit criteria

No user changes are at risk, every current failure is attributable, and owner
decisions needed for data/repository work are written down.

### Phase 1: freeze the vNext normative contract

Write short RFCs before generator or API implementation:

1. Product and module boundaries.
2. Non-negotiable invariants from section 6.
3. Protocol envelope, typed errors, request IDs, and capability negotiation.
4. Command identity and canonical fingerprinting.
5. Authoritative game definition and creation policy.
6. Portable JSON Schema profile.
7. Replay/retention/privacy semantics.
8. Client coordinator state machine.

#### Required artifacts

- [ ] Machine-readable protocol/capability schemas.
- [ ] State-transition tables for server mutations and client coordinator.
- [ ] Error/retry/outcome-certainty table.
- [ ] Example game contract manifest.
- [ ] D1/DO migration sketches.
- [ ] Compatibility rollout examples.

#### Exit criteria

The owner and implementing agent can answer, without reading implementation
code: who is authoritative, what is stored, how a retry is identified, how an
old client is gated, how a game finishes after a transient fault, and what an
offline client displays.

### Phase 2: consolidate the platform repository without semantic changes

Skip only if the owner explicitly chooses to keep separate repositories. If
kept separate, create an atomic cross-repo integration/release mechanism before
vNext contract changes.

#### Work

- [ ] Import histories into the chosen monorepo layout.
- [ ] Preserve current package names and APIs.
- [ ] Bring all lint/typecheck/test/build/generation workflows across.
- [ ] Make the docs build consume local workspace artifacts from the same SHA.
- [ ] Add one root `check` command and a platform manifest generator.
- [ ] Add exact generated-file drift checks.
- [ ] Prove package publish dry runs without publishing.

#### Exit criteria

Behavior and generated output are identical to the pre-move baseline, all tests
pass, and a single revision can build server, Dart client, Flutter, scaffold,
examples, and docs.

### Phase 3: fix existing kernel and reducer correctness defects

Do this before expanding protocol behavior.

#### Work

- [ ] Add failing multi-transition timing-model tests.
- [ ] Persist current turn timing/chargeability.
- [ ] Charge the prior turn and calculate the next turn separately.
- [ ] Fix/reconcile the exact alarm boundary.
- [ ] Add failing terminal-absorption and gap-integrity client tests.
- [ ] Make terminal lifecycle absorbing.
- [ ] Validate gap sequences before applying a newer snapshot.
- [ ] Fix pending-action early-return cleanup and any related reducer leaks.

#### Exit criteria

All timing modes match the reference model over generated transition sequences;
no event ordering can resurrect a terminal session or apply an invalid gap.

### Phase 4: establish safe mutation identity before retries

This phase must land before adding client or Worker-to-DO mutation retries.

#### Work

- [ ] Define canonical request hashing and stable operation names.
- [ ] Require client-created `commandId` on every mutation.
- [ ] Extend DO dedupe records with authorization scope and fingerprint.
- [ ] Implement mismatch conflict behavior.
- [ ] Add idempotent D1 create reservation for regular and solo games.
- [ ] Build the pure-Dart command journal and in-memory fake.
- [ ] Generate/store command IDs before network send.
- [ ] Classify definitive versus ambiguous outcomes.
- [ ] Add narrowly bounded retry for current Cloudflare retryable DO errors,
      recreating the stub as official guidance requires.
- [ ] Ensure overload and deterministic failures are never retried.

#### Exit criteria

A fault-injected response loss at every mutation point produces exactly one
semantic mutation and the same authorized response. Reusing an identity across
actor/kind/target/payload returns `409` without disclosing stored session data.

### Phase 5: move setup authority and capability negotiation to the server

#### Work

- [ ] Introduce server `CreationPolicy` and canonical setup result.
- [ ] Define engine absolute resource limits.
- [ ] Create a capabilities endpoint/manifest with exact contract IDs.
- [ ] Separate readable, writable, and creatable contract sets.
- [ ] Gate join by exact membership before seating.
- [ ] Gate create by current server creatable contract.
- [ ] Generate typed Flutter creation descriptors.
- [ ] Convert regular, solo, bot, and rated creation to one policy path.
- [ ] Delete the client-authoritative create fields and scalar schema maximum
      after reference clients migrate.

#### Exit criteria

No forged request can choose unsupported setup; sparse version sets work;
client-first and server-first rollouts are covered by integration tests; old
clients cannot create retired games.

### Phase 6: close server recovery and security loops

#### Work

- [ ] Persist desired alarm generation with each transition.
- [ ] Reconcile alarms on post-commit, activation, duplicate, session, and alarm
      paths.
- [ ] Automatically retry finish outboxes with backoff.
- [ ] Add bounded D1 mirror reconciliation.
- [ ] Add protected inspect/reconcile tooling.
- [ ] Add socket-ticket mint/consume flow.
- [ ] Remove identity tokens from WebSocket URLs and logs.
- [ ] Prevent unknown IDs from allocating/migrating DO storage.
- [ ] Add join-code and expensive-endpoint abuse controls.
- [ ] Enforce central request/game/history/resource budgets.
- [ ] Add structured request/command correlation and core metrics.

#### Exit criteria

Fault injection proves deadlines and finishes recover without another player
action or manual intervention; random game IDs leave no storage; credentials do
not enter URLs/logs; limit and abuse tests pass.

### Phase 7: build the client coordinator, then extract packages

#### Work

- [ ] Implement the coordinator as a pure-Dart deterministic reducer.
- [ ] Feed local cache, HTTP results, socket sessions, gap results, auth, and
      connection events through it.
- [ ] Persist latest sessions and pending commands through an interface.
- [ ] Add explicit connection/compatibility/auth states and jittered reconnect.
- [ ] Wire all game screens and mutations to coordinator state.
- [ ] Make Riverpod a thin lifecycle/presentation adapter.
- [ ] Extract pure protocol/client packages.
- [ ] Extract Flutter adapters.
- [ ] Move `MaterialApp.router` and product screens into the optional shell.
- [ ] Move Firebase/auth/push/analytics/crash code into an optional adapter.
- [ ] Add a no-cloud local identity adapter.
- [ ] Remove legacy response/socket merger and global package assumptions.

#### Exit criteria

A headless Dart integration test can create/connect/act/reconnect without
Flutter. An embedding Flutter example owns its own `MaterialApp`. A default
shell example still provides the batteries-included path. Both run locally with
no Firebase credentials.

### Phase 8: enforce the portable game contract and typed renderer

#### Work

- [ ] Implement `eigen-json-1` validation in the contract emitter.
- [ ] Generate Dart codecs and validators for every supported keyword.
- [ ] Add exact generated-file ownership manifests.
- [ ] Generate typed `GameDefinition<Observation, Action, Config>` client
      bindings and creation descriptors.
- [ ] Make infrastructure call the generated action serializer.
- [ ] Remove `Object`, raw action maps, and game-author casts from the normal
      renderer path.
- [ ] Remove mandatory Dart legality/rating/bot predicates.
- [ ] Add optional non-authoritative predictor interface.
- [ ] Migrate all reference games.

#### Exit criteria

Unsupported schema semantics fail generation; supported constraints behave the
same in TypeScript and Dart; widgets submit typed actions; no reference game
duplicates authoritative business policy in Dart.

### Phase 9: stabilize replay, privacy, offline reads, and optional modules

#### Work

- [ ] Implement the approved exact-frame/projector retention policy.
- [ ] Generate public replay artifacts explicitly.
- [ ] Add cursor- and byte-bounded history paging.
- [ ] Enforce PII/state policy and document export/deletion.
- [ ] Build a deliberate local read model for latest sessions/summaries and
      pending commands.
- [ ] Implement honest cold-offline UI.
- [ ] Make ratings, bots, social, avatars, push, and marketing/legal surfaces
      capability modules.
- [ ] Add localization, accessibility, adaptive UI, and richer shell branding.
- [ ] Decide and document iOS support.

#### Exit criteria

Replay remains stable across deployments according to policy, deletion/export
tests cover all stores, cold offline is truthful, and minimal apps do not depend
on optional product modules.

### Phase 10: documentation, release proof, and cleanup

#### Work

- [ ] Rewrite docs against the final vNext contract.
- [ ] Make examples executable and generated references deterministic.
- [ ] Add Android release AAB, browser E2E, local Worker, and adapter emulator
      gates.
- [ ] Run the complete reference-game matrix.
- [ ] Exercise operational drills and rollback.
- [ ] Produce a vNext platform manifest and migration guide.
- [ ] Delete legacy endpoints, scalar version negotiation, client-authoritative
      setup, mandatory twins, obsolete sync workflows, and stale docs.
- [ ] Publish dry runs for every package and site.
- [ ] Obtain explicit owner approval before real publishing, deployment,
      remote archival, credentials, or data reset.

#### Exit criteria

All definition-of-done items in section 22 pass from a fresh checkout and a
newly scaffolded game.

### Work-package ownership matrix

Use this to assign or parallelize work only after the dependency phase permits
it. “Primary areas” are starting points, not permission to ignore generated
consumers.

| Work package | Depends on | Primary areas | Must land with |
| --- | --- | --- | --- |
| A. Timing correctness | RFC invariants | TS rules/kernel, DO timing columns | model/property tests, DO migration, timing docs, Flutter display verification |
| B. Protocol foundation | RFC protocol/errors | protocol schemas, server wire/OpenAPI, Dart protocol | request IDs, typed errors, generated clients, compatibility docs |
| C. Safe idempotency | B | server routes, DO dedupe, D1 create reservation, Dart journal | authorization/fingerprint tests, response-loss fault tests, retry table |
| D. Creation authority | B, C | TS game definition, create routes, contract generator, Flutter create UI | generated descriptors, forged-client tests, all creation examples/docs |
| E. Exact capabilities | B, D | capabilities endpoint/manifest, join/create gates, Dart negotiation | rolling deployment matrix, contract digest generation, version docs |
| F. Recovery loops | A, C | DO desired alarm/outbox, D1 reconciliation, operator tools | failure injection, metrics, runbooks, local inspector |
| G. Security and budgets | B, C | socket tickets, game-handle checks, rate/size limits | redaction tests, abuse tests, production scaffold config, security docs |
| H. Client coordinator | B, C, E | pure Dart reducer/store/transport, existing Flutter providers/screens | ordering model tests, local persistence, explicit UX states |
| I. Package split | H | Dart client, Flutter adapter, shell, Firebase adapter | dependency checks, headless/embedding/default examples, publish dry runs |
| J. Portable schema/typed renderer | D, I | TS contract emitter, Dart generator, renderer API | profile conformance, exact file manifest, migrated reference games/docs |
| K. Replay/privacy | E, F, J, owner decision | DO history/frame schema, paging, local read model, deletion/export | deployment-stability tests, retention policy, privacy docs/runbook |
| L. Release proof | all | scaffolder, three examples, CI, docs, operations | browser E2E, Android AAB/emulator, drills, platform manifest |

Good review boundaries are one invariant or one behavior-preserving move. Avoid
a single change that simultaneously moves repositories, changes the wire,
rewrites generators, and refactors UI; failures would be impossible to
attribute or roll back.

## 16. Required reference games

RPS is a valuable hidden-information example, but one reference game cannot
validate the engine contract. vNext release requires all three.

### 16.1 Hidden simultaneous-action game

Use RPS or an equivalent commit/reveal game. It must prove:

- multiple pending seats;
- a hidden action changes authoritative state without changing another seat's
  observation;
- stale same-view submissions are accepted correctly;
- reveal changes the view and rejects genuinely stale actions;
- participant versus public replay visibility;
- reconnect/gap behavior during hidden commits;
- no cross-seat dedupe or logging leakage.

### 16.2 Sequential budget-clock game with overrides

Use a small tactical/race game. It must prove:

- accumulated banks and increments;
- normal -> override -> normal timing transitions;
- exact boundary and timeout behavior;
- alarm recovery after failure/reset;
- forfeit, deletion auto-forfeit, and finish;
- response-loss retry and journal reconciliation.

### 16.3 Three-to-six-player teams/elimination game

Use a party/strategy game with dynamic setup. It must prove:

- config-dependent valid player counts;
- teams, ties, elimination, and outcome validation;
- server-authoritative creation metadata;
- bot capability and optional ratings;
- sparse/rolling contract negotiation;
- larger observations/history within byte limits;
- social/push modules optional rather than core assumptions.

### 16.4 Matrix every reference game must pass

- fresh local scaffold with local identity;
- generated contract and typed renderer;
- malformed/oversized setup/action rejection;
- join by ID and code;
- normal and ambiguous mutation response;
- disconnect/reconnect/no-gap/gap;
- timeout and alarm recovery where timed;
- finish and outbox recovery;
- live and historical replay according to visibility;
- account deletion during active play and after finish;
- exact contract capability gating;
- browser E2E and Android release build;
- docs sample compilation.

## 17. Test architecture and CI matrix

### 17.1 Pure model/property tests

- Kernel reference-model/property tests for state versions, pending seats,
  clocks, deadlines, outcomes, and deterministic RNG.
- Client coordinator model tests for every ordering of response, socket, gap,
  reconnect, auth, cache, and terminal events.
- Canonical JSON/fingerprint properties.
- Portable schema parity and fuzz tests.
- Projection noninterference tests where reference-game state generators make it
  possible: changing hidden data must not change an unauthorized observation.

### 17.2 Server integration/fault tests

Run under the actual Workers/workerd test environment:

- DO input/output gate and SQLite transaction behavior;
- object reset/recreated stub transient errors;
- D1 transient/constraint/overload classification;
- response loss after commit;
- alarm failure, early alarm, obsolete alarm, and reset;
- finish outbox restart/retry;
- WebSocket hibernation/reconnect/ticket validation;
- random-ID allocation prevention;
- rate and resource limits;
- migration from the immediately previous vNext development schema.

### 17.3 Dart/Flutter tests

- Pure Dart coordinator tests with in-memory transport/store/clock.
- SQLite adapter restart and corruption/error behavior.
- Auth refresh/expiry/upgrade tests.
- Widget tests for every connection and command state.
- Accessibility semantics, keyboard, text scale, narrow/wide layouts, and
  localization.
- Browser socket integration against a local Worker.
- Deep-link and notification-before-router flows in the optional shell.

### 17.4 End-to-end and release tests

- Fresh scaffolder in a temporary directory.
- One root command starts local server, local identity, and Flutter web app.
- Browser automation creates, joins, acts, disconnects, reconnects, and replays.
- Android release AAB from the freshly scaffolded game.
- Android emulator smoke against local/staging server.
- Firebase emulator suite for the optional adapter.
- Documented physical-device push smoke.
- Minimum/current Node, Flutter, and Dart support matrix.
- Package publish dry runs and generated-doc site build.

### 17.5 CI invariants

CI must fail on:

- unformatted or unanalyzed source;
- type/test/build failure in any package;
- generated content drift or stale generated files;
- schema/migration drift;
- OpenAPI/capability/client mismatch;
- docs current-version mismatch or broken compiled samples;
- unrecorded public package changes;
- dependency direction violation, such as pure Dart importing Flutter/Firebase;
- missing platform manifest update for a release-affecting change;
- failure of any reference-game matrix.

Do not make flaky networked production services a merge gate. Use local
emulators/fakes for deterministic CI and scheduled/manual smoke tests for real
external delivery.

## 18. API and storage migration inventory

This is a clean-breaking vNext inventory, not final SQL/OpenAPI. Update it as
RFCs settle exact names.

### 18.1 HTTP changes

Add or replace:

- `GET /capabilities`: protocol, feature, and exact game-contract inventory.
- `POST /games`: required command ID, exact contract ID, setup intent; returns
  canonical created session/summary.
- `POST /games/solo`: same mutation identity and creation policy, or fold into
  `POST /games` with a typed opponent/setup intent.
- all lobby and live mutation requests: required command ID.
- `POST /games/{id}/socket-ticket`: short-lived scoped ticket.
- bounded cursor-based `GET /games/{id}/frames` or `/history` with byte-aware
  page metadata.
- protected readiness/diagnostics and operator reconcile endpoints, or an
  equivalent authenticated CLI surface.

Remove after migration:

- scalar `clientSchemaVersion` join semantics;
- client-authoritative `minPlayers`, `maxPlayers`, and unconstrained clock
  fields;
- identity bearer token in WebSocket query;
- optional command IDs;
- claims that HTTP package SemVer is the protocol capability.

Every response should carry a request ID in a header and/or stable error
envelope. Define whether successful mutation responses include the command ID;
the recommended answer is yes for correlation.

### 18.2 Stable error vocabulary

Add stable codes at least for:

- `idempotencyConflict`;
- `contractUnsupported`;
- `contractNotCreatable`;
- `protocolUnsupported`;
- `setupInvalid`;
- `payloadTooLarge`;
- `resourceLimit`;
- `socketTicketInvalid` / `socketTicketExpired` where exposing the distinction
  is safe;
- `invalidCursor` if not already present in the current implementation.

Keep human messages non-normative. Flutter acts on stable code, HTTP status,
retry metadata, and outcome certainty.

### 18.3 D1 changes

Likely additions:

- creation idempotency/reservation table keyed by principal and command ID,
  containing fingerprint, game ID, result, and timestamps;
- protocol/platform metadata where deployment inventory needs it;
- exact `contract_id` on games, not only an ordered schema integer;
- read/write/create contract status inventory if not fully static in Worker
  code;
- operational/reconciliation index fields such as authoritative version/seq,
  mirror update time, or repair marker where useful;
- socket ticket storage only if tickets cannot be self-contained/one-use via an
  existing coordination primitive;
- module migrations that are conditional or absent when optional features are
  disabled, if the final module design supports that safely.

Do not turn D1 into the live command arbiter. Creation is the exception because
the game does not yet have an initialized DO and uniqueness must be reserved.

### 18.4 Durable Object changes

Likely additions/replacements:

- explicit initialization marker/canonical create record;
- exact contract ID/profile version;
- durable current timing kind/chargeability;
- desired alarm timestamp and generation;
- dedupe authorization scope, operation, target, fingerprint, and result;
- outbox attempt/next-attempt/last-error metadata as needed for recovery;
- retained exact participant/public frames according to owner policy;
- schema migration version visible to inspection tooling.

Make migrations restart-safe and idempotent. For early development data, obtain
approval for a reset rather than writing a large one-off migration that will
never serve a user. Still test the migration mechanism that production will
eventually rely on.

### 18.5 Local client storage

Use an explicit versioned schema containing:

- latest session bytes/model plus protocol/contract ID;
- pending command ID, canonical request, operation, target, state, created time,
  last attempt, and safe failure metadata;
- cached summaries/replay metadata required by offline read UI;
- auth-scope partition key so one user's private data never appears to another.

On sign-out/account change, isolate or purge user-scoped data best-effort without
blocking credential removal. On incompatible cache migration, retain only data
that can be safely decoded or delete it with a clear policy.

Pending actions and cached observations may contain private game information.
Use platform-appropriate local data protection, exclude sensitive databases
from unintended cloud backup where required, never place them in analytics or
crash breadcrumbs, and document what “delete local data” removes.

## 19. Acceptance criteria by invariant

The implementation is not complete until these observable statements are true.

### Authority and contracts

- [ ] A forged create request cannot choose unsupported seats, clocks, rating,
      bot setup, config, or contract.
- [ ] The server response contains canonical setup and Flutter renders it.
- [ ] A client supporting contracts `{1,3}` is never seated into `2`.
- [ ] An old client cannot continue creating a retired contract.
- [ ] Unsupported schema semantics fail generation with a precise path.
- [ ] Every supported constraint validates equivalently in TypeScript and Dart.
- [ ] Reference games contain no mandatory authoritative Dart legality, rating,
      or bot implementation.

### Mutation integrity

- [ ] Every mutation, including create, has a client-created durable ID.
- [ ] A lost response followed by retry causes exactly one semantic change and
      returns the same authorized result.
- [ ] Reusing an ID with another actor, operation, target, seat, version, or
      payload returns `409`.
- [ ] No reused/guessed ID can reveal another viewer's observation.
- [ ] Retryable DO faults are retried with the same ID and recreated stub;
      overload and deterministic errors are not.

### Timing and recovery

- [ ] Normal and override turns charge the correct preceding budget across
      multi-transition generated tests.
- [ ] Boundary actions and alarms follow one explicit comparison rule.
- [ ] An alarm-arm failure repairs itself without another player action.
- [ ] A transient finish failure retries automatically, applies ratings once,
      updates D1, and clears the outbox.
- [ ] Exhausted mirror retries are visible and repairable.

### Client convergence

- [ ] HTTP and socket copies converge under every ordering.
- [ ] Terminal state cannot be replaced by delayed active state.
- [ ] Incomplete or invalid gap pages are rejected and resynchronized.
- [ ] Cold offline shows marked stale state and disables unsupported writes.
- [ ] Decode incompatibility produces explicit update-required UI.
- [ ] A pending command survives process restart and is reconciled exactly once.
- [ ] No mutation occurs inside a generally retryable provider build without the
      coordinator's durable identity semantics.

### Security and abuse

- [ ] No identity bearer token appears in a WebSocket URL, access log, trace,
      analytics event, crash report, or exception.
- [ ] Tickets reject expiry, replay, wrong user, wrong game, and wrong origin.
- [ ] Random nonexistent game IDs leave no initialized DO storage.
- [ ] Join-code brute force and expensive endpoints have tested abuse controls.
- [ ] State/action/config/observation/history/response limits reject before
      expensive work.
- [ ] Account deletion behavior is tested for active, finished, rated, bot, and
      hidden-information games.

### Developer and operational experience

- [ ] A fresh scaffold reaches a local first move with no Firebase/cloud
      credentials.
- [ ] An existing Flutter app can embed the client without the optional shell.
- [ ] The default shell remains a coherent batteries-included product.
- [ ] Operators can identify delayed alarms, stale mirrors, old outboxes,
      reconnect storms, and incompatible clients.
- [ ] Backup/export/restore/deletion and failure-repair drills have run in a
      non-production environment.
- [ ] Android release, browser E2E, all unit/integration suites, generation
      drift, package dry runs, and docs build pass.

## 20. Risks and rollback strategy

### 20.1 Highest implementation risks

| Risk | Mitigation |
| --- | --- |
| Mixing repo moves with semantic changes | Behavior-preserving monorepo phase with exact baseline diff |
| Retrying before idempotency is safe | Hard sequencing dependency: fingerprints first, retries second |
| Creating a complex cross-language DSL | Generate types/validators/descriptors only; keep rules TS-only |
| Replacing one giant Flutter package with too many packages | Enforce logical boundaries first; publish only useful units |
| Overengineering operations before users | Implement closed-loop correctness and observability; defer cold tier/microservices |
| Keeping legacy paths forever | Date/phase-bound legacy adapters and delete after reference clients migrate |
| Losing hidden information through dedupe/logging/replay | Authorization-scoped results, projection tests, safe structured logging |
| Mobile rollout incompatibility | Exact capabilities and client-first additive rollout tests |
| Data migration complexity for unused dev data | Owner-approved reset while retaining/test-driving production migration mechanism |
| Optional modules becoming core again | Dependency-direction CI and minimal headless example |

### 20.2 Rollback principles

- Every semantic work package should have a narrow feature/version seam until
  its reference clients pass, but temporary dual paths must have a deletion
  condition.
- Never roll back by deleting a finish outbox, dedupe record, or pending client
  mutation whose outcome is unknown.
- Prefer forward repair of durable desired state over reversing a committed game
  transition.
- Protocol rollbacks must respect already installed clients; use capability
  flags and additive disablement.
- Storage rollbacks require backup and explicit migration support once any real
  user data exists.
- Optional adapters/modules should be disableable without changing game truth.
- Record deployment revision, protocol features, and contract inventory so an
  operator knows which rollback is compatible.

## 21. Rules for the implementing agent

### 21.1 Working method

1. Treat all three current repositories and the new platform repository as one
   product, but never assume a change in one is complete until generated clients,
   examples, tests, and docs agree.
2. Begin each phase by updating a checked-in execution plan/decision log.
3. Add failing invariant tests before implementation.
4. Keep changes reviewable: separate moves, behavior changes, generation, and
   cleanup where possible.
5. Preserve unrelated user edits and generated-artifact provenance.
6. Use current official Cloudflare documentation for every platform behavior or
   limit; do not rely on this review's remembered details.
7. Prefer the smallest platform primitive that closes the correctness loop.
8. Do not introduce a service, queue, workflow, database, or abstraction merely
   because it is fashionable.
9. Update this document or its successor when a recommendation changes, with
   rationale and affected acceptance criteria.
10. Stop for owner authorization at the explicit destructive/external gates,
    not for ordinary reversible implementation details.

### 21.2 Suggested validation commands

Revalidate actual scripts before use. At the review snapshot, useful commands
included:

```bash
# Server workspace
cd /Users/seenuk/projects/eigeninteractive/eigen-server
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm openapi
pnpm dart-client

# Flutter
cd /Users/seenuk/projects/eigeninteractive/eigen-flutter
flutter pub get
dart format --output=none --set-exit-if-changed .
dart run build_runner build
flutter analyze
flutter test

# Web/docs
cd /Users/seenuk/projects/eigeninteractive/eigen-web
pnpm install --frozen-lockfile
pnpm check-docs-version
pnpm check-admonitions
pnpm lint
pnpm typecheck
pnpm build
```

Some suites need local network binding and Wrangler log access. In a restricted
sandbox, request the appropriate execution permission rather than treating an
`EPERM` as a product failure or weakening the tests.

### 21.3 Completion report for each phase

Report:

- decisions made and why;
- source/API/storage/doc changes;
- migrations and compatibility behavior;
- exact validation commands and results;
- generated artifacts changed;
- observability added;
- known limitations and follow-up;
- whether any owner gate is next.

## 22. Definition of done for EigenInteractive vNext

vNext is complete only when all of the following hold:

### Architecture

- [ ] One DO remains the sole serialized authority per game.
- [ ] D1 is demonstrably only a registry/read model for live play.
- [ ] TypeScript is the sole authoritative game-rule implementation.
- [ ] Game setup is server-owned and generated to the client.
- [ ] Protocol, contract, storage, package, and platform versions are separate.
- [ ] The pure Dart client, Flutter adapter, optional shell, and Firebase adapter
      have enforced dependency boundaries.
- [ ] One platform revision atomically builds contracts, packages, examples,
      and docs.

### Correctness and reliability

- [ ] All section 19 acceptance criteria pass.
- [ ] Timing property tests and coordinator model tests pass.
- [ ] Mutation idempotency is end-to-end and authorization-scoped.
- [ ] Alarm and finish recovery are automatic and observable.
- [ ] Replay and retention match the recorded owner decision.
- [ ] Account deletion and privacy behavior match the documented data model.

### Product/developer experience

- [ ] Fresh local first move requires no cloud account or Firebase setup.
- [ ] A typed renderer submits typed actions without raw JSON/casts.
- [ ] Optional modules are genuinely optional.
- [ ] All three reference games pass the complete matrix.
- [ ] Browser and Android are built/tested as advertised; iOS status is explicit.
- [ ] Documentation is current, task-first, generated where appropriate, and
      internally consistent.

### Operations and release

- [ ] Structured logs, metrics, readiness, repair tooling, and runbooks exist.
- [ ] Fault-injection and operational drills pass.
- [ ] CI reproduces all package/build/generation/reference-game gates from a
      fresh checkout.
- [ ] Package/site publish dry runs pass.
- [ ] A platform manifest and migration guide exist.
- [ ] The owner separately approves actual publish/deploy/remote archival/data
      reset actions.

## 23. Evidence index

This is a navigation index for revalidation, not a substitute for reading the
surrounding code.

### Product and authority

- `eigen-web/docs/how-it-works/overview.md:7-109`
- `eigen-web/docs/build-a-game/the-contract.md:7-192`
- `eigen-server/packages/rules/src/contract.ts:252-319`

### Core commit, timing, persistence, and recovery

- `eigen-server/packages/kernel/src/commit.ts:1-175,211-320,395-453`
- `eigen-server/packages/kernel/src/timing.ts:1-101`
- `eigen-server/packages/server/src/do/game-do.ts:118-147,395-490,651-743,1015-1069,1118-1120`
- `eigen-server/packages/server/src/do/schema.ts:20-125`
- `eigen-server/packages/server/src/d1/apply.ts:251-330`
- `eigen-server/packages/server/src/d1/retry.ts`
- `eigen-server/packages/server/src/lifecycle/cron.ts:1-115`

### HTTP policy, identity, and abuse

- `eigen-server/packages/server/src/routes/wire.ts:266-363`
- `eigen-server/packages/server/src/routes/games.ts:126-220,322-381,458-571`
- `eigen-server/packages/server/src/routes/reads.ts:60-95`
- `eigen-server/packages/server/src/engine.ts:239-255,274-360,419-485`
- `eigen-server/packages/server/src/rate-limit.ts:1-78`
- `eigen-server/packages/server/src/lifecycle/purge.ts:1-107`

### Flutter bootstrap, contract, and session flow

- `eigen-flutter/lib/app_runner.dart:20-121`
- `eigen-flutter/lib/core/config/app_config.dart:32-152`
- `eigen-flutter/lib/core/game/game_creation_spec.dart:1-115`
- `eigen-flutter/lib/core/game/game_module.dart:1-100,175-350`
- `eigen-flutter/lib/core/game/game_session.dart:1-76`
- `eigen-flutter/lib/core/api/game_socket.dart:9-153`
- `eigen-flutter/lib/core/api/retry_policy.dart:6-52`
- `eigen-flutter/lib/features/game/data/game_repository.dart:188-435`
- `eigen-flutter/lib/features/game/providers/game_providers.dart:125-166,303-317`
- `eigen-flutter/lib/features/game/presentation/screens/game_screen.dart:320-395`
- `eigen-flutter/lib/features/game/presentation/widgets/new_game_dialog.dart:217-249`
- `eigen-flutter/lib/features/game/presentation/screens/lobby_screen.dart:257-388`

### Code generation and docs claims

- `eigen-flutter/lib/src/codegen/payload_generator.dart:145-330,410-428`
- `eigen-flutter/lib/src/codegen/payload_emitter.dart:315-359`
- `eigen-flutter/lib/testing/twin_fixtures.dart:341-448`
- `eigen-web/docs/getting-started/quickstart.md:204-229`
- `eigen-web/docs/build-a-game/schemas.md:7-134`
- `eigen-web/docs/build-a-game/creation-ui.md:7-94`
- `eigen-web/docs/build-a-game/versions.md:40-80`
- `eigen-web/docs/reference/compatibility.md:18-55,115-209`

### Primary external documentation

- Eigen live source of truth: <https://eigeninteractive.com/llms-full.txt>
- Eigen OpenAPI: <https://eigeninteractive.com/openapi.json>
- Cloudflare DO rules:
  <https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/>
- Cloudflare DO error handling:
  <https://developers.cloudflare.com/durable-objects/best-practices/error-handling/>
- Cloudflare DO lifecycle:
  <https://developers.cloudflare.com/durable-objects/concepts/durable-object-lifecycle/>
- Cloudflare DO limits:
  <https://developers.cloudflare.com/durable-objects/platform/limits/>
- Cloudflare D1 limits:
  <https://developers.cloudflare.com/d1/platform/limits/>
- Flutter offline-first architecture:
  <https://docs.flutter.dev/app-architecture/design-patterns/offline-first>

## 24. Immediate next action

When the owner authorizes implementation, do **not** start by moving code or
renaming packages. Start Phase 0, record the owner decisions, then write the
small vNext normative RFCs from Phase 1. The first code changes should be
failing tests for the budget-clock association and terminal absorption. The
first retry code must not land until authorization-scoped idempotency
fingerprints are implemented.

That ordering is the shortest path to a simple system: lock the invariants,
prove the current correctness bugs, then reshape packages around the resulting
contract.
