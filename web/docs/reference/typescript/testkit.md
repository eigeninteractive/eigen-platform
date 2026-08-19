# @eigeninteractive/testkit

`@eigeninteractive/testkit`: drive a game's rules through the real kernel without a
Worker, a database or a network. Build a table, submit actions as seats,
assert on the resulting transitions and per-seat observations.

## Interfaces

### ActionCase

Defined in: [server/packages/testkit/src/twin-fixtures.ts:84](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L84)

A game-action case: exercises schemas, `applyAction`, and (through
`expected.observation`) `computeObservation` for the acting seat.

#### Properties

##### action

```ts
action: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:95](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L95)

##### config

```ts
config: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:87](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L87)

##### expected

```ts
expected: {
  observation?: JsonObject;
  outcome?: OutcomeEntry[] | null;
  pending?: number[];
  state?: JsonObject;
  valid: boolean;
};
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:96](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L96)

###### observation?

```ts
optional observation?: JsonObject;
```

###### outcome?

```ts
optional outcome?: OutcomeEntry[] | null;
```

###### pending?

```ts
optional pending?: number[];
```

###### state?

```ts
optional state?: JsonObject;
```

###### valid

```ts
valid: boolean;
```

##### kind

```ts
kind: "action";
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:85](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L85)

##### name

```ts
name: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:86](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L86)

##### obs?

```ts
optional obs?: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:90](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L90)

Dart-side observation payload; unused here (defaults to `state`).

##### participantCount?

```ts
optional participantCount?: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:93](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L93)

##### pending

```ts
pending: number[];
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:91](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L91)

##### playerIndex

```ts
playerIndex: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:92](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L92)

##### rngSeed?

```ts
optional rngSeed?: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:94](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L94)

##### state

```ts
state: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:88](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L88)

***

### BotSeatableCase

Defined in: [server/packages/testkit/src/twin-fixtures.ts:128](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L128)

A `botSeatable` predicate case.

#### Properties

##### botConfig

```ts
botConfig: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:132](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L132)

##### expected

```ts
expected: boolean;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:133](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L133)

##### gameConfig

```ts
gameConfig: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:131](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L131)

##### kind

```ts
kind: "botSeatable";
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:129](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L129)

##### name

```ts
name: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:130](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L130)

***

### BuildGameContractOptions

Defined in: [server/packages/testkit/src/game-contract.ts:45](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L45)

Inputs for building a [GameContract](#gamecontract) without writing it.

#### Extended by

- [`EmitGameContractOptions`](#emitgamecontractoptions)

#### Properties

##### fixturesRoot?

```ts
optional fixturesRoot?: any;
```

Defined in: [server/packages/testkit/src/game-contract.ts:51](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L51)

Root containing `v<N>/*.json` twin fixtures.

##### game

```ts
game: string;
```

Defined in: [server/packages/testkit/src/game-contract.ts:47](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L47)

Stable display name used as the generated Dart type prefix.

##### gameModule

```ts
gameModule: GameModule;
```

Defined in: [server/packages/testkit/src/game-contract.ts:49](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L49)

Authoritative TypeScript rules registry.

***

### CommitInput

Defined in: server/packages/kernel/dist/index.d.ts:288

#### Properties

##### game

```ts
game: GameRow;
```

Defined in: server/packages/kernel/dist/index.d.ts:289

##### intent

```ts
intent: Intent;
```

Defined in: server/packages/kernel/dist/index.d.ts:294

##### now

```ts
now: number;
```

Defined in: server/packages/kernel/dist/index.d.ts:297

The commit instant (epoch ms), sampled once by the host and never read
here.

##### roster

```ts
roster: Seat[];
```

Defined in: server/packages/kernel/dist/index.d.ts:293

##### rules

```ts
rules: GameRules;
```

Defined in: server/packages/kernel/dist/index.d.ts:300

The version unit for the game's `schemaVersion`, already resolved by
the host from the `GameModule.versions` map.

##### staleViews?

```ts
optional staleViews?: {
  current: SeatView | null;
  expected: SeatView | null;
};
```

Defined in: server/packages/kernel/dist/index.d.ts:308

Same-view material for a stale game action: the acting seat's stored
frames at `expectedVersion` and at the current version. Only consulted
when `intent.expectedVersion < state.version`; if absent (or either
frame is missing, e.g. compacted away), the stale action is rejected
conservatively.

###### current

```ts
current: SeatView | null;
```

###### expected

```ts
expected: SeatView | null;
```

##### state

```ts
state: StateRow | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:292

The latest transition, or null before v0 (only a `start` intent is
meaningful then).

***

### CommitPlan

Defined in: server/packages/kernel/dist/index.d.ts:354

#### Properties

##### action

```ts
action: TransitionAction | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:357

##### effects

```ts
effects: Effect[];
```

Defined in: server/packages/kernel/dist/index.d.ts:368

##### frames

```ts
frames: ObservationFrame[];
```

Defined in: server/packages/kernel/dist/index.d.ts:360

Per-seat projected frames (identified seats only), persisted with the
transition, fanned out over sockets. No raw state escapes the kernel.

##### nextState

```ts
nextState: StateRow;
```

Defined in: server/packages/kernel/dist/index.d.ts:356

The next transition row, already versioned (`v+1`, or 0 for start).

##### outcomes

```ts
outcomes: OutcomeEntry[] | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:367

Per-seat results when this transition ends the game, else null.

Rating deltas are deliberately NOT here: they depend on global cross-game
priors (D1-domain data the kernel must never need). The D1 applier
computes them inside the rating CAS via `computeRatings` (ratings.ts) and
the host delivers them as a follow-up versioned ratings transition.

***

### EmitGameContractOptions

Defined in: [server/packages/testkit/src/game-contract.ts:55](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L55)

Inputs for emitting or checking a [GameContract](#gamecontract) file.

#### Extends

- [`BuildGameContractOptions`](#buildgamecontractoptions)

#### Properties

##### fixturesRoot?

```ts
optional fixturesRoot?: any;
```

Defined in: [server/packages/testkit/src/game-contract.ts:51](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L51)

Root containing `v<N>/*.json` twin fixtures.

###### Inherited from

[`BuildGameContractOptions`](#buildgamecontractoptions).[`fixturesRoot`](#fixturesroot)

##### game

```ts
game: string;
```

Defined in: [server/packages/testkit/src/game-contract.ts:47](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L47)

Stable display name used as the generated Dart type prefix.

###### Inherited from

[`BuildGameContractOptions`](#buildgamecontractoptions).[`game`](#game)

##### gameModule

```ts
gameModule: GameModule;
```

Defined in: [server/packages/testkit/src/game-contract.ts:49](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L49)

Authoritative TypeScript rules registry.

###### Inherited from

[`BuildGameContractOptions`](#buildgamecontractoptions).[`gameModule`](#gamemodule)

##### output

```ts
output: any;
```

Defined in: [server/packages/testkit/src/game-contract.ts:57](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L57)

Destination `game-contract.json` path.

***

### GameContract

Defined in: [server/packages/testkit/src/game-contract.ts:37](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L37)

Language-neutral schemas and fixtures shared by a game's Worker and app.

#### Properties

##### fixtures

```ts
fixtures: GameContractFixture[];
```

Defined in: [server/packages/testkit/src/game-contract.ts:41](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L41)

##### formatVersion

```ts
formatVersion: 1;
```

Defined in: [server/packages/testkit/src/game-contract.ts:38](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L38)

##### game

```ts
game: string;
```

Defined in: [server/packages/testkit/src/game-contract.ts:39](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L39)

##### versions

```ts
versions: Record<string, GameContractVersion>;
```

Defined in: [server/packages/testkit/src/game-contract.ts:40](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L40)

***

### GameContractFixture

Defined in: [server/packages/testkit/src/game-contract.ts:19](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L19)

One validated twin-fixture document embedded in a [GameContract](#gamecontract).

#### Properties

##### document

```ts
document: unknown;
```

Defined in: [server/packages/testkit/src/game-contract.ts:23](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L23)

Validated fixture document, retained in its original JSON shape.

##### path

```ts
path: string;
```

Defined in: [server/packages/testkit/src/game-contract.ts:21](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L21)

POSIX-style path relative to the supplied fixtures root.

***

### GameContractVersion

Defined in: [server/packages/testkit/src/game-contract.ts:27](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L27)

The four JSON Schemas emitted for one game `schemaVersion`.

#### Properties

##### schemas

```ts
schemas: {
  action: Record<string, unknown>;
  config: Record<string, unknown>;
  observation: Record<string, unknown>;
  state: Record<string, unknown>;
};
```

Defined in: [server/packages/testkit/src/game-contract.ts:28](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L28)

###### action

```ts
action: Record<string, unknown>;
```

###### config

```ts
config: Record<string, unknown>;
```

###### observation

```ts
observation: Record<string, unknown>;
```

###### state

```ts
state: Record<string, unknown>;
```

***

### GameRow

Defined in: server/packages/kernel/dist/index.d.ts:223

The game's standing configuration: the DO `meta` snapshot.

#### Properties

##### budgetSeconds

```ts
budgetSeconds: number | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:230

##### config

```ts
config: JsonObject;
```

Defined in: server/packages/kernel/dist/index.d.ts:228

Stored creation config; parsed against the version unit's config schema
before any hook sees it.

##### incrementSeconds

```ts
incrementSeconds: number | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:231

##### rated

```ts
rated: boolean;
```

Defined in: server/packages/kernel/dist/index.d.ts:232

##### ratingPool

```ts
ratingPool: string | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:233

##### schemaVersion

```ts
schemaVersion: number;
```

Defined in: server/packages/kernel/dist/index.d.ts:225

##### status

```ts
status: GameStatus;
```

Defined in: server/packages/kernel/dist/index.d.ts:224

##### turnSeconds

```ts
turnSeconds: number | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:229

***

### ObservationFrame

Defined in: server/packages/kernel/dist/index.d.ts:115

One seat's projected frame, tagged with its seat. The host stamps
version/timing when it persists and fans these out.

#### Properties

##### data

```ts
data: JsonObject;
```

Defined in: server/packages/kernel/dist/index.d.ts:117

##### pendingPlayers

```ts
pendingPlayers: number[];
```

Defined in: server/packages/kernel/dist/index.d.ts:118

##### playerIndex

```ts
playerIndex: number;
```

Defined in: server/packages/kernel/dist/index.d.ts:116

***

### PlayerLimitsCase

Defined in: [server/packages/testkit/src/twin-fixtures.ts:120](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L120)

A `playerLimits` case: the seats one config may be played with.

#### Properties

##### config

```ts
config: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:123](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L123)

##### expected

```ts
expected: {
  maxPlayers: number;
  minPlayers: number;
};
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:124](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L124)

###### maxPlayers

```ts
maxPlayers: number;
```

###### minPlayers

```ts
minPlayers: number;
```

##### kind

```ts
kind: "playerLimits";
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:121](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L121)

##### name

```ts
name: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:122](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L122)

***

### RatingPoolCase

Defined in: [server/packages/testkit/src/twin-fixtures.ts:106](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L106)

A `ratingPool` predicate case. Omitted timing fields mean null.

#### Properties

##### access

```ts
access: GameAccess;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:109](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L109)

##### budgetSeconds?

```ts
optional budgetSeconds?: number | null;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:111](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L111)

##### config

```ts
config: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:115](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L115)

##### expected

```ts
expected: string | null;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:116](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L116)

##### incrementSeconds?

```ts
optional incrementSeconds?: number | null;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:112](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L112)

##### kind

```ts
kind: "ratingPool";
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:107](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L107)

##### maxPlayers

```ts
maxPlayers: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:114](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L114)

##### minPlayers

```ts
minPlayers: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:113](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L113)

##### name

```ts
name: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:108](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L108)

##### turnSeconds?

```ts
optional turnSeconds?: number | null;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:110](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L110)

***

### Rejected

Defined in: server/packages/kernel/dist/index.d.ts:45

An intent the kernel refused. A value, not a throw: rejections are part
of the normal protocol.

#### Properties

##### code

```ts
code: RejectCode;
```

Defined in: server/packages/kernel/dist/index.d.ts:47

##### message

```ts
message: string;
```

Defined in: server/packages/kernel/dist/index.d.ts:48

##### rejected

```ts
rejected: true;
```

Defined in: server/packages/kernel/dist/index.d.ts:46

***

### Seat

Defined in: server/packages/kernel/dist/index.d.ts:237

One seat of the roster. Both ids null ⇒ the account was purged mid-game
(the seat plays on as "Deleted User" for display, but can never act).

#### Properties

##### botId

```ts
botId: string | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:240

##### playerIndex

```ts
playerIndex: number;
```

Defined in: server/packages/kernel/dist/index.d.ts:238

##### type

```ts
type: "bot" | "human";
```

Defined in: server/packages/kernel/dist/index.d.ts:241

##### userId

```ts
userId: string | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:239

***

### SeatView

Defined in: server/packages/kernel/dist/index.d.ts:93

A seat's stored projection at one version: what the same-view compare
runs on (and what the DO persists per transition as `frames[]`).

#### Properties

##### data

```ts
data: JsonObject;
```

Defined in: server/packages/kernel/dist/index.d.ts:94

##### pendingPlayers

```ts
pendingPlayers: number[];
```

Defined in: server/packages/kernel/dist/index.d.ts:95

***

### StateRow

Defined in: server/packages/kernel/dist/index.d.ts:245

The latest committed transition: state plus the engine-owned clocks. All
instants are epoch milliseconds.

#### Properties

##### deadline

```ts
deadline: number | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:252

The true turn deadline shown to clients; the alarm arms one millisecond
after `deadline + grace`.

##### pending

```ts
pending: number[];
```

Defined in: server/packages/kernel/dist/index.d.ts:248

##### playerTimes

```ts
playerTimes: number[] | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:254

Per-seat budget banks (ms), budget mode only.

##### rngSeed

```ts
rngSeed: string;
```

Defined in: server/packages/kernel/dist/index.d.ts:249

##### state

```ts
state: JsonObject;
```

Defined in: server/packages/kernel/dist/index.d.ts:247

##### turnStartedAt

```ts
turnStartedAt: number | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:258

When the current turn is consuming a budget bank. Null for untimed,
per-action, and hook-override turns. This is persisted so charging the
turn that ends never depends on the next envelope.

##### version

```ts
version: number;
```

Defined in: server/packages/kernel/dist/index.d.ts:246

***

### TwinFixtureFile

Defined in: [server/packages/testkit/src/twin-fixtures.ts:77](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L77)

One fixture file: cases targeting one `schemaVersion` unit.

#### Properties

##### cases

```ts
cases: TwinFixtureCase[];
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:79](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L79)

##### schemaVersion

```ts
schemaVersion: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:78](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L78)

## Type Aliases

### Effect

```ts
type Effect =
  | {
  botId: string;
  kind: "wakeBot";
  seat: number;
}
  | {
  kind: "notifyTurn";
  seat: number;
  userId: string;
}
  | {
  kind: "notifyFinished";
  userIds: string[];
};
```

Defined in: server/packages/kernel/dist/index.d.ts:342

A push/wake the host should attempt post-commit (single attempt + error
log, with no retry machinery in v1). The kernel names seats; the host resolves
delivery (FCM targets, bot webhook vs local bot).

***

### Intent

```ts
type Intent =
  | {
  kind: "start";
  seed: string;
}
  | {
  actor: "user" | "bot";
  data: unknown;
  expectedVersion: number;
  kind: "action";
  seat: number;
}
  | {
  kind: "lifecycle";
  type: "timeout";
}
  | {
  kind: "lifecycle";
  seat: number;
  type: "forfeit" | "autoForfeit";
};
```

Defined in: server/packages/kernel/dist/index.d.ts:262

What the host asks the kernel to do: the kernel-facing half of a
`Command` (authorization already happened at the edge; dedupe at the DO).

#### Union Members

##### Type Literal

```ts
{
  kind: "start";
  seed: string;
}
```

###### kind

```ts
kind: "start";
```

###### seed

```ts
seed: string;
```

The game's base RNG seed, freshly generated by the host
(`randomSeed()`); stored on v0 and copied to every later row.

***

##### Type Literal

```ts
{
  actor: "user" | "bot";
  data: unknown;
  expectedVersion: number;
  kind: "action";
  seat: number;
}
```

###### actor

```ts
actor: "user" | "bot";
```

###### data

```ts
data: unknown;
```

The raw move payload, parsed against the unit's action schema.

###### expectedVersion

```ts
expectedVersion: number;
```

The version the client computed the move against. Equal to the
current version in the common case; a *lower* value is arbitrated by
the same-view rule.

###### kind

```ts
kind: "action";
```

###### seat

```ts
seat: number;
```

***

##### Type Literal

```ts
{
  kind: "lifecycle";
  type: "timeout";
}
```

***

##### Type Literal

```ts
{
  kind: "lifecycle";
  seat: number;
  type: "forfeit" | "autoForfeit";
}
```

`forfeit` = a voluntary resign (a user action); `autoForfeit` = the
engine-driven variant (account purge; identity-less system action).

***

### RejectCode

```ts
type RejectCode =
  | "notActive"
  | "notReady"
  | "expired"
  | "notPending"
  | "stateUpdated"
  | "invalidPayload"
  | "illegalMove"
  | "abstain";
```

Defined in: server/packages/kernel/dist/index.d.ts:24

Why an intent was refused. Stable machine codes: the host's transport
mapping and the client's retry policy key on these, so treat renames as
breaking.

***

### TwinFixtureCase

```ts
type TwinFixtureCase =
  | ActionCase
  | PlayerLimitsCase
  | RatingPoolCase
  | BotSeatableCase;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:136](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L136)

## Variables

### GAME\_CONTRACT\_FORMAT\_VERSION

```ts
const GAME_CONTRACT_FORMAT_VERSION: 1 = 1;
```

Defined in: [server/packages/testkit/src/game-contract.ts:16](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L16)

Current format of the language-neutral contract consumed by EigenInteractive's Dart generator.

## Functions

### buildGameContract()

```ts
function buildGameContract(options): GameContract;
```

Defined in: [server/packages/testkit/src/game-contract.ts:150](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L150)

Build a deterministic in-memory contract without touching the filesystem.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options` | [`BuildGameContractOptions`](#buildgamecontractoptions) |

#### Returns

[`GameContract`](#gamecontract)

***

### checkConfiguredGameContract()

```ts
function checkConfiguredGameContract(root?): Promise<void>;
```

Defined in: [server/packages/testkit/src/contract-command.ts:76](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/contract-command.ts#L76)

Fails when the conventionally configured contract is absent or stale.

Use this in CI through `eigen-contract --check`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `root` | `any` |

#### Returns

`Promise`\<`void`\>

***

### checkGameContract()

```ts
function checkGameContract(options): void;
```

Defined in: [server/packages/testkit/src/game-contract.ts:194](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L194)

Fail when an emitted contract is missing or differs from its inputs.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options` | [`EmitGameContractOptions`](#emitgamecontractoptions) |

#### Returns

`void`

***

### commit()

```ts
function commit(input): CommitPlan | Rejected;
```

Defined in: server/packages/kernel/dist/index.d.ts:372

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `input` | [`CommitInput`](#commitinput) |

#### Returns

[`CommitPlan`](#commitplan) \| [`Rejected`](#rejected)

***

### deepEquals()

```ts
function deepEquals(a, b): boolean;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:518](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L518)

Structural JSON equality. Object keys with `undefined` values count as
absent (matching how schema libraries model optional fields); array order
matters.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `a` | `Json` \| `undefined` |
| `b` | `Json` \| `undefined` |

#### Returns

`boolean`

***

### deriveRng()

```ts
function deriveRng(seed, version): Rng;
```

Defined in: server/packages/kernel/dist/index.d.ts:388

The deterministic RNG for one transition: rand-seed's sfc32 keyed by the
game's base seed and the state version the envelope will commit as. The
same `(seed, version)` always yields the same draw sequence, so a replay
re-derives it, and every transition gets an independent stream, so hooks
draw as many values as they need with no cross-invocation state. The
derivation is fixed, so recorded games stay replayable.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `seed` | `string` |
| `version` | `number` |

#### Returns

`Rng`

***

### emitConfiguredGameContract()

```ts
function emitConfiguredGameContract(root?): Promise<void>;
```

Defined in: [server/packages/testkit/src/contract-command.ts:67](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/contract-command.ts#L67)

Emits `game-contract.json` from an EigenInteractive package's conventional layout.

This is the programmatic form of the `eigen-contract` executable. Most
games should invoke the executable through their package script.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `root` | `any` |

#### Returns

`Promise`\<`void`\>

***

### emitGameContract()

```ts
function emitGameContract(options): void;
```

Defined in: [server/packages/testkit/src/game-contract.ts:188](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L188)

Emit one deterministic, newline-terminated `game-contract.json`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options` | [`EmitGameContractOptions`](#emitgamecontractoptions) |

#### Returns

`void`

***

### evaluateTwinCase()

```ts
function evaluateTwinCase(rules, kase): string[];
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:299](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L299)

Run one fixture case against a rules unit, returning failure descriptions
(empty ⇒ the case passes). Pure; the file-reading test registrar is
[twinFixtureTests](#twinfixturetests).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `rules` | `GameRules` |
| `kase` | [`TwinFixtureCase`](#twinfixturecase) |

#### Returns

`string`[]

***

### gameContractFilename()

```ts
function gameContractFilename(game): string;
```

Defined in: [server/packages/testkit/src/game-contract.ts:202](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L202)

A useful default filename for scripts that accept an output directory.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `game` | `string` |

#### Returns

`string`

***

### gameContractJson()

```ts
function gameContractJson(options): string;
```

Defined in: [server/packages/testkit/src/game-contract.ts:183](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L183)

Render one deterministic, newline-terminated contract document.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options` | [`BuildGameContractOptions`](#buildgamecontractoptions) |

#### Returns

`string`

***

### isRejected()

```ts
function isRejected(result): result is Rejected;
```

Defined in: server/packages/kernel/dist/index.d.ts:371

Type guard: did `commit()` refuse the intent?

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `result` | [`CommitPlan`](#commitplan) \| [`Rejected`](#rejected) |

#### Returns

`result is Rejected`

***

### parseTwinFixtureFile()

```ts
function parseTwinFixtureFile(path, json): TwinFixtureFile;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:270](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L270)

Validate one fixture file's parsed JSON, or throw naming the offending
file, case, and field. Exported so a repo can lint its fixtures without
running them.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `path` | `string` |
| `json` | `unknown` |

#### Returns

[`TwinFixtureFile`](#twinfixturefile)

***

### projectView()

```ts
function projectView(rules, args): SeatView;
```

Defined in: [server/packages/testkit/src/kernel-scenarios.ts:39](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/kernel-scenarios.ts#L39)

Project one seat's view of a state: the stored-frame shape the same-view
rule compares (`commit()`'s `staleViews` input). Convenience for scenario
tests that replay a simultaneous-move race.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `rules` | `GameRules` | - |
| `args` | \{ `cause?`: `TransitionCause`; `config`: `JsonObject`; `isReplay?`: `boolean`; `participantCount?`: `number`; `pending`: `number`[]; `seat`: `number` \| `null`; `state`: `JsonObject`; \} | - |
| `args.cause?` | `TransitionCause` | - |
| `args.config` | `JsonObject` | - |
| `args.isReplay?` | `boolean` | - |
| `args.participantCount?` | `number` | - |
| `args.pending` | `number`[] | - |
| `args.seat` | `number` \| `null` | The seat to project for, or null for a viewer. |
| `args.state` | `JsonObject` | - |

#### Returns

[`SeatView`](#seatview)

***

### randomSeed()

```ts
function randomSeed(): string;
```

Defined in: server/packages/kernel/dist/index.d.ts:381

A fresh base seed for a new game: 128 random bits, hex-encoded. Stored on
the game's v0 state row and copied onto every later row (server-only,
never expose it: the whole randomness of the game is derivable from it).

#### Returns

`string`

***

### twinFixtureTests()

```ts
function twinFixtureTests(gameModule, fixturesRoot): void;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:317](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L317)

Register one vitest test per fixture case found under `fixturesRoot`
(layout: `<root>/v<N>/*.json`). Call at the top level of a test module
running in a Node environment.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `gameModule` | `GameModule` |
| `fixturesRoot` | `any` |

#### Returns

`void`

## References

### DEADLINE\_GRACE\_MS

Re-exports [DEADLINE_GRACE_MS](server.md#deadline_grace_ms)
