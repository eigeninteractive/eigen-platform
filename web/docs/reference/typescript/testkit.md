# @eigeninteractive/testkit

`@eigeninteractive/testkit`: drive a game's rules through the real kernel without a
Worker, a database or a network. Build a table, submit actions as seats,
assert on the resulting transitions and per-seat observations.

## Interfaces

### ActionCase

Defined in: [server/packages/testkit/src/twin-fixtures.ts:177](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L177)

A game-action case: exercises schemas, `applyAction`, and (through
`expected.observation`) `computeObservation` for the acting seat.

#### Properties

##### action

```ts
action: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:188](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L188)

##### config

```ts
config: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:180](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L180)

##### expected

```ts
expected: ExpectedEnvelope & {
  observation?: JsonObject;
  valid: boolean;
};
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:189](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L189)

###### Type Declaration

###### observation?

```ts
optional observation?: JsonObject;
```

###### valid

```ts
valid: boolean;
```

##### kind

```ts
kind: "action";
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:178](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L178)

##### name

```ts
name: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:179](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L179)

##### obs?

```ts
optional obs?: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:183](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L183)

Dart-side observation payload; unused here (defaults to `state`).

##### participantCount?

```ts
optional participantCount?: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:186](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L186)

##### pending

```ts
pending: number[];
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:184](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L184)

##### playerIndex

```ts
playerIndex: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:185](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L185)

##### rngSeed?

```ts
optional rngSeed?: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:187](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L187)

##### state

```ts
state: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:181](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L181)

***

### BotSeatableCase

Defined in: [server/packages/testkit/src/twin-fixtures.ts:218](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L218)

A `botSeatable` predicate case.

#### Properties

##### botConfig

```ts
botConfig: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:222](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L222)

##### expected

```ts
expected: boolean;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:223](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L223)

##### gameConfig

```ts
gameConfig: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:221](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L221)

##### kind

```ts
kind: "botSeatable";
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:219](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L219)

##### name

```ts
name: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:220](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L220)

***

### BuildGameContractOptions

Defined in: [server/packages/testkit/src/game-contract.ts:45](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L45)

Inputs for building a [GameContract](#gamecontract) without writing it.

#### Extended by

- [`EmitGameContractOptions`](#emitgamecontractoptions)

#### Properties

##### fixturesRoot?

```ts
optional fixturesRoot?: string | URL;
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

Defined in: server/packages/kernel/dist/index.d.ts:248

#### Properties

##### game

```ts
game: GameRow;
```

Defined in: server/packages/kernel/dist/index.d.ts:249

##### intent

```ts
intent: Intent;
```

Defined in: server/packages/kernel/dist/index.d.ts:254

##### now

```ts
now: number;
```

Defined in: server/packages/kernel/dist/index.d.ts:257

The commit instant (epoch ms), sampled once by the host and never read
here.

##### roster

```ts
roster: Seat[];
```

Defined in: server/packages/kernel/dist/index.d.ts:253

##### rules

```ts
rules: GameRules;
```

Defined in: server/packages/kernel/dist/index.d.ts:260

The version unit for the game's `schemaVersion`, already resolved by
the host from the `GameModule.versions` map.

##### staleViews?

```ts
optional staleViews?: {
  current: SeatView | null;
  expected: SeatView | null;
};
```

Defined in: server/packages/kernel/dist/index.d.ts:268

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

Defined in: server/packages/kernel/dist/index.d.ts:252

The latest transition, or null before v0 (only a `start` intent is
meaningful then).

***

### CommitPlan

Defined in: server/packages/kernel/dist/index.d.ts:314

#### Properties

##### action

```ts
action: TransitionAction | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:317

##### effects

```ts
effects: Effect[];
```

Defined in: server/packages/kernel/dist/index.d.ts:328

##### frames

```ts
frames: ObservationFrame[];
```

Defined in: server/packages/kernel/dist/index.d.ts:320

Per-seat projected frames (identified seats only), persisted with the
transition, fanned out over sockets. No raw state escapes the kernel.

##### nextState

```ts
nextState: StateRow;
```

Defined in: server/packages/kernel/dist/index.d.ts:316

The next transition row, already versioned (`v+1`, or 0 for start).

##### outcomes

```ts
outcomes: OutcomeEntry[] | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:327

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
optional fixturesRoot?: string | URL;
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
output: string | URL;
```

Defined in: [server/packages/testkit/src/game-contract.ts:57](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/game-contract.ts#L57)

Destination `game-contract.json` path.

***

### ExpectedEnvelope

Defined in: [server/packages/testkit/src/twin-fixtures.ts:169](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L169)

What a case may assert about the envelope a hook (or a whole transcript)
produced. Every field is optional: a fixture pins what it means to pin.
`outcome` is three-valued — absent leaves the outcome unchecked, `null`
asserts the game is ongoing, a list asserts it ended exactly so.

#### Properties

##### outcome?

```ts
optional outcome?: OutcomeEntry[] | null;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:172](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L172)

##### pending?

```ts
optional pending?: number[];
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:171](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L171)

##### state?

```ts
optional state?: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:170](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L170)

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

Defined in: server/packages/kernel/dist/index.d.ts:183

The game's standing configuration: the DO `meta` snapshot.

#### Properties

##### budgetSeconds

```ts
budgetSeconds: number | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:190

##### config

```ts
config: JsonObject;
```

Defined in: server/packages/kernel/dist/index.d.ts:188

Stored creation config; parsed against the version unit's config schema
before any hook sees it.

##### incrementSeconds

```ts
incrementSeconds: number | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:191

##### rated

```ts
rated: boolean;
```

Defined in: server/packages/kernel/dist/index.d.ts:192

##### ratingPool

```ts
ratingPool: string | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:193

##### schemaVersion

```ts
schemaVersion: number;
```

Defined in: server/packages/kernel/dist/index.d.ts:185

##### status

```ts
status: GameStatus;
```

Defined in: server/packages/kernel/dist/index.d.ts:184

##### turnSeconds

```ts
turnSeconds: number | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:189

***

### InitialStateCase

Defined in: [server/packages/testkit/src/twin-fixtures.ts:228](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L228)

The opening transition: what `initialState` returns for one config and
seat count, drawing from the version-0 stream a `start` commit derives.

#### Properties

##### config

```ts
config: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:231](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L231)

##### expected

```ts
expected: ExpectedEnvelope;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:234](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L234)

##### kind

```ts
kind: "initialState";
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:229](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L229)

##### name

```ts
name: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:230](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L230)

##### playerCount

```ts
playerCount: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:232](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L232)

##### rngSeed?

```ts
optional rngSeed?: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:233](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L233)

***

### LifecycleCase

Defined in: [server/packages/testkit/src/twin-fixtures.ts:239](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L239)

An `applyLifecycle` case: one engine-driven transition (a turn that ran
out, a resign, a purged account) resolved against a stated position.

#### Properties

##### config

```ts
config: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:242](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L242)

##### expected

```ts
expected: ExpectedEnvelope;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:251](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L251)

##### kind

```ts
kind: "lifecycle";
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:240](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L240)

##### name

```ts
name: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:241](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L241)

##### participantCount?

```ts
optional participantCount?: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:249](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L249)

##### pending

```ts
pending: number[];
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:244](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L244)

##### playerIndex?

```ts
optional playerIndex?: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:248](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L248)

The forfeiting seat. Required for `forfeit`/`autoForfeit`; a `timeout`
carries no seat (its victims are `pending`), so it must be omitted.

##### rngSeed?

```ts
optional rngSeed?: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:250](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L250)

##### state

```ts
state: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:243](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L243)

##### type

```ts
type: LifecycleType;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:245](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L245)

***

### ObservationFrame

Defined in: server/packages/kernel/dist/index.d.ts:103

One seat's projected frame, tagged with its seat. The host stamps
version/timing when it persists and fans these out.

#### Properties

##### data

```ts
data: JsonObject;
```

Defined in: server/packages/kernel/dist/index.d.ts:105

##### pendingPlayers

```ts
pendingPlayers: number[];
```

Defined in: server/packages/kernel/dist/index.d.ts:106

##### playerIndex

```ts
playerIndex: number;
```

Defined in: server/packages/kernel/dist/index.d.ts:104

***

### PlayerLimitsCase

Defined in: [server/packages/testkit/src/twin-fixtures.ts:210](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L210)

A `playerLimits` case: the seats one config may be played with.

#### Properties

##### config

```ts
config: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:213](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L213)

##### expected

```ts
expected: {
  maxPlayers: number;
  minPlayers: number;
};
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:214](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L214)

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

Defined in: [server/packages/testkit/src/twin-fixtures.ts:211](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L211)

##### name

```ts
name: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:212](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L212)

***

### RatingPoolCase

Defined in: [server/packages/testkit/src/twin-fixtures.ts:196](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L196)

A `ratingPool` predicate case. Omitted timing fields mean null.

#### Properties

##### access

```ts
access: GameAccess;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:199](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L199)

##### budgetSeconds?

```ts
optional budgetSeconds?: number | null;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:201](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L201)

##### config

```ts
config: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:205](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L205)

##### expected

```ts
expected: string | null;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:206](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L206)

##### incrementSeconds?

```ts
optional incrementSeconds?: number | null;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:202](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L202)

##### kind

```ts
kind: "ratingPool";
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:197](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L197)

##### maxPlayers

```ts
maxPlayers: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:204](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L204)

##### minPlayers

```ts
minPlayers: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:203](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L203)

##### name

```ts
name: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:198](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L198)

##### turnSeconds?

```ts
optional turnSeconds?: number | null;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:200](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L200)

***

### Rejected

Defined in: server/packages/kernel/dist/index.d.ts:43

An intent the kernel refused. A value, not a throw: rejections are part
of the normal protocol.

#### Properties

##### code

```ts
code: RejectCode;
```

Defined in: server/packages/kernel/dist/index.d.ts:45

##### message

```ts
message: string;
```

Defined in: server/packages/kernel/dist/index.d.ts:46

##### rejected

```ts
rejected: true;
```

Defined in: server/packages/kernel/dist/index.d.ts:44

***

### RngCase

Defined in: [server/packages/testkit/src/twin-fixtures.ts:277](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L277)

Recorded draws from one derived RNG stream. Generated by
[rngFixtureCase](#rngfixturecase), never hand-written: the values ARE the TypeScript
kernel's, and the Dart port has to reproduce them bit for bit.

#### Properties

##### draws

```ts
draws: number[];
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:285](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L285)

##### kind

```ts
kind: "rng";
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:278](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L278)

##### name

```ts
name: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:279](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L279)

##### seat?

```ts
optional seat?: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:284](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L284)

Present ⇒ the bot stream for that seat, keyed `"<seed>:bot<seat>"`.

##### seed

```ts
seed: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:280](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L280)

##### version

```ts
version: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:282](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L282)

The state version the stream belongs to (`deriveRng`'s second arg).

***

### RngFixtureCaseOptions

Defined in: [server/packages/testkit/src/twin-fixtures.ts:980](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L980)

What stream to record, and how much of it.

#### Properties

##### count

```ts
count: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:990](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L990)

How many draws to record (1 to 64).

##### name

```ts
name: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:982](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L982)

The case name, used as the test name on both sides.

##### seat?

```ts
optional seat?: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:988](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L988)

Record the bot stream for this seat instead of the transition's own.

##### seed

```ts
seed: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:984](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L984)

The game's base seed.

##### version

```ts
version: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:986](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L986)

The state version whose stream to record.

***

### Seat

Defined in: server/packages/kernel/dist/index.d.ts:197

One seat of the roster. Both ids null ⇒ the account was purged mid-game
(the seat plays on as "Deleted User" for display, but can never act).

#### Properties

##### botId

```ts
botId: string | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:200

##### playerIndex

```ts
playerIndex: number;
```

Defined in: server/packages/kernel/dist/index.d.ts:198

##### type

```ts
type: "bot" | "human";
```

Defined in: server/packages/kernel/dist/index.d.ts:201

##### userId

```ts
userId: string | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:199

***

### SeatView

Defined in: server/packages/kernel/dist/index.d.ts:85

A seat's stored projection at one version: what the same-view compare
runs on (and what the DO persists per transition as `frames[]`).

#### Properties

##### data

```ts
data: JsonObject;
```

Defined in: server/packages/kernel/dist/index.d.ts:86

##### pendingPlayers

```ts
pendingPlayers: number[];
```

Defined in: server/packages/kernel/dist/index.d.ts:87

***

### StateRow

Defined in: server/packages/kernel/dist/index.d.ts:205

The latest committed transition: state plus the engine-owned clocks. All
instants are epoch milliseconds.

#### Properties

##### deadline

```ts
deadline: number | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:212

The true turn deadline shown to clients; the alarm arms one millisecond
after `deadline + grace`.

##### pending

```ts
pending: number[];
```

Defined in: server/packages/kernel/dist/index.d.ts:208

##### playerTimes

```ts
playerTimes: number[] | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:214

Per-seat budget banks (ms), budget mode only.

##### rngSeed

```ts
rngSeed: string;
```

Defined in: server/packages/kernel/dist/index.d.ts:209

##### state

```ts
state: JsonObject;
```

Defined in: server/packages/kernel/dist/index.d.ts:207

##### turnStartedAt

```ts
turnStartedAt: number | null;
```

Defined in: server/packages/kernel/dist/index.d.ts:218

When the current turn is consuming a budget bank. Null for untimed,
per-action, and hook-override turns. This is persisted so charging the
turn that ends never depends on the next envelope.

##### version

```ts
version: number;
```

Defined in: server/packages/kernel/dist/index.d.ts:206

***

### TranscriptCase

Defined in: [server/packages/testkit/src/twin-fixtures.ts:260](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L260)

A whole match, replayed through the real kernel from a stated base seed.
The one case that pins the *engine's* bookkeeping — versions, pending
hand-off, the per-transition RNG streams — rather than a single hook.

#### Properties

##### config

```ts
config: JsonObject;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:263](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L263)

##### expected

```ts
expected: ExpectedEnvelope & {
  status: "active" | "finished";
  version: number;
};
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:268](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L268)

###### Type Declaration

###### status

```ts
status: "active" | "finished";
```

###### version

```ts
version: number;
```

##### kind

```ts
kind: "transcript";
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:261](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L261)

##### name

```ts
name: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:262](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L262)

##### playerCount

```ts
playerCount: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:264](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L264)

##### seed

```ts
seed: string;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:266](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L266)

The game's base RNG seed: every transition's stream derives from it.

##### transitions

```ts
transitions: TranscriptTransition[];
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:267](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L267)

***

### TwinFixtureFile

Defined in: [server/packages/testkit/src/twin-fixtures.ts:160](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L160)

One fixture file: cases targeting one `schemaVersion` unit.

#### Properties

##### cases

```ts
cases: TwinFixtureCase[];
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:162](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L162)

##### schemaVersion

```ts
schemaVersion: number;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:161](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L161)

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

Defined in: server/packages/kernel/dist/index.d.ts:302

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

Defined in: server/packages/kernel/dist/index.d.ts:222

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

Defined in: server/packages/kernel/dist/index.d.ts:22

Why an intent was refused. Stable machine codes: the host's transport
mapping and the client's retry policy key on these, so treat renames as
breaking.

***

### TranscriptTransition

```ts
type TranscriptTransition =
  | {
  data: JsonObject;
  kind: "game";
  playerIndex: number;
}
  | {
  kind: "lifecycle";
  playerIndex: number;
  type: "forfeit";
};
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:255](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L255)

One transition of a [TranscriptCase](#transcriptcase): a seat's move, or a resign.

***

### TwinFixtureCase

```ts
type TwinFixtureCase =
  | ActionCase
  | PlayerLimitsCase
  | RatingPoolCase
  | BotSeatableCase
  | InitialStateCase
  | LifecycleCase
  | TranscriptCase
  | RngCase;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:288](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L288)

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

Defined in: server/packages/kernel/dist/index.d.ts:332

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

Defined in: [server/packages/testkit/src/twin-fixtures.ts:1079](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L1079)

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

Defined in: server/packages/kernel/dist/index.d.ts:345

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
function evaluateTwinCase(
   rules,
   kase,
   schemaVersion?
): string[];
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:596](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L596)

Run one fixture case against a rules unit, returning failure descriptions
(empty ⇒ the case passes). Pure; the file-reading test registrar is
[twinFixtureTests](#twinfixturetests).

`schemaVersion` is the version the case targets. It never selects
behavior — the caller already resolved `rules` from it — and only labels
the engine guard messages a `lifecycle` or `transcript` case can provoke;
[twinFixtureTests](#twinfixturetests) passes the fixture file's.

#### Parameters

| Parameter | Type | Default value |
| ------ | ------ | ------ |
| `rules` | `GameRules` | `undefined` |
| `kase` | [`TwinFixtureCase`](#twinfixturecase) | `undefined` |
| `schemaVersion` | `number` | `1` |

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

Defined in: server/packages/kernel/dist/index.d.ts:331

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

Defined in: [server/packages/testkit/src/twin-fixtures.ts:554](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L554)

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

Defined in: server/packages/kernel/dist/index.d.ts:338

A fresh base seed for a new game: 128 random bits, hex-encoded. Stored on
the game's v0 state row and copied onto every later row (server-only,
never expose it: the whole randomness of the game is derivable from it).

#### Returns

`string`

***

### rngFixtureCase()

```ts
function rngFixtureCase(options): RngCase;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:994](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L994)

Record one derived stream from the real kernel as a fixture case.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `options` | [`RngFixtureCaseOptions`](#rngfixturecaseoptions) |

#### Returns

[`RngCase`](#rngcase)

***

### twinFixtureTests()

```ts
function twinFixtureTests(gameModule, fixturesRoot): void;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:622](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L622)

Register one vitest test per fixture case found under `fixturesRoot`
(layout: `<root>/v<N>/*.json`). Call at the top level of a test module
running in a Node environment.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `gameModule` | `GameModule` |
| `fixturesRoot` | `string` \| `URL` |

#### Returns

`void`

***

### writeRngFixture()

```ts
function writeRngFixture(path, cases): void;
```

Defined in: [server/packages/testkit/src/twin-fixtures.ts:1031](https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/testkit/src/twin-fixtures.ts#L1031)

Write a fixture file of generated `rng` cases.

The `schemaVersion` is read from the `v<N>/` directory in `path`, the same
rule `eigen-contract` enforces over every fixture file, so the two can
never be written out of agreement. The document is validated before it is
written: a generator that emits something the runners would refuse to load
should fail at the generator.

The output is plain two-space JSON. Only the values mean anything to either
runner, so a repo that formats JSON should run its formatter afterwards.

```ts
import { rngFixtureCase, writeRngFixture } from "@eigeninteractive/testkit";

writeRngFixture("src/module/fixtures/v1/rng.json", [
  rngFixtureCase({ name: "version 0", seed: "twin-fixtures", version: 0, count: 16 }),
  rngFixtureCase({ name: "seat 1's bot stream", seed: "twin-fixtures", version: 3, seat: 1, count: 16 }),
]);
```

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `path` | `string` |
| `cases` | [`RngCase`](#rngcase)[] |

#### Returns

`void`

## References

### DEADLINE\_GRACE\_MS

Re-exports [DEADLINE_GRACE_MS](server.md#deadline_grace_ms)
