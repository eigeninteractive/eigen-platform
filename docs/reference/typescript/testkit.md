# @eigen/testkit

`@eigen/testkit` — drive a game's rules through the real kernel without a
Worker, a database or a network. Build a table, submit actions as seats,
assert on the resulting transitions and per-seat observations.

## Interfaces

### ActionCase

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:83](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L83)

A game-action case — exercises schemas, `applyAction`, and (through
`expected.observation`) `computeObservation` for the acting seat.

#### Properties

##### action

```ts
action: JsonObject;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:94](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L94)

##### config

```ts
config: JsonObject;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:86](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L86)

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

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:95](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L95)

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

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:84](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L84)

##### name

```ts
name: string;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:85](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L85)

##### obs?

```ts
optional obs?: JsonObject;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:89](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L89)

Dart-side observation payload; unused here (defaults to `state`).

##### participantCount?

```ts
optional participantCount?: number;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:92](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L92)

##### pending

```ts
pending: number[];
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:90](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L90)

##### playerIndex

```ts
playerIndex: number;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:91](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L91)

##### rngSeed?

```ts
optional rngSeed?: string;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:93](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L93)

##### state

```ts
state: JsonObject;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:87](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L87)

***

### BotSeatableCase

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:119](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L119)

A `botSeatable` predicate case.

#### Properties

##### botConfig

```ts
botConfig: JsonObject;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:123](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L123)

##### expected

```ts
expected: boolean;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:124](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L124)

##### gameConfig

```ts
gameConfig: JsonObject;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:122](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L122)

##### kind

```ts
kind: "botSeatable";
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:120](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L120)

##### name

```ts
name: string;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:121](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L121)

***

### CommitInput

Defined in: eigen-server/packages/kernel/dist/index.d.ts:286

#### Properties

##### game

```ts
game: GameRow;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:287

##### intent

```ts
intent: Intent;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:292

##### now

```ts
now: number;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:295

The commit instant (epoch ms) — sampled once by the host, never read
here.

##### roster

```ts
roster: Seat[];
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:291

##### rules

```ts
rules: GameRules;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:298

The version unit for the game's `schema_version`, already resolved by
the host from the `GameModule.versions` map.

##### staleViews?

```ts
optional staleViews?: {
  current: SeatView | null;
  expected: SeatView | null;
};
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:306

Same-view material for a stale game action: the acting seat's stored
frames at `expectedVersion` and at the current version. Only consulted
when `intent.expectedVersion < state.version`; if absent (or either
frame is missing — e.g. compacted away), the stale action is rejected
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

Defined in: eigen-server/packages/kernel/dist/index.d.ts:290

The latest transition, or null before v0 (only a `start` intent is
meaningful then).

***

### CommitPlan

Defined in: eigen-server/packages/kernel/dist/index.d.ts:352

#### Properties

##### action

```ts
action: TransitionAction | null;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:355

##### alarm

```ts
alarm: number | null;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:368

The instant the DO must arm its alarm at — the true deadline plus the
grace window — or null to clear it.

##### effects

```ts
effects: Effect[];
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:369

##### frames

```ts
frames: ObservationFrame[];
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:358

Per-seat projected frames (identified seats only) — persisted with the
transition, fanned out over sockets. No raw state escapes the kernel.

##### nextState

```ts
nextState: StateRow;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:354

The next transition row, already versioned (`v+1`, or 0 for start).

##### outcomes

```ts
outcomes: OutcomeEntry[] | null;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:365

Per-seat results when this transition ends the game, else null.

Rating deltas are deliberately NOT here: they depend on global cross-game
priors (D1-domain data the kernel must never need). The D1 applier
computes them inside the rating CAS via `computeRatings` (ratings.ts) and
the host delivers them as a follow-up versioned ratings transition.

***

### GameRow

Defined in: eigen-server/packages/kernel/dist/index.d.ts:224

The game's standing configuration — the DO `meta` snapshot.

#### Properties

##### budgetSeconds

```ts
budgetSeconds: number | null;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:231

##### config

```ts
config: JsonObject;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:229

Stored creation config; parsed against the version unit's config schema
before any hook sees it.

##### incrementSeconds

```ts
incrementSeconds: number | null;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:232

##### rated

```ts
rated: boolean;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:233

##### ratingPool

```ts
ratingPool: string | null;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:234

##### schemaVersion

```ts
schemaVersion: number;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:226

##### status

```ts
status: GameStatus;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:225

##### turnSeconds

```ts
turnSeconds: number | null;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:230

***

### ObservationFrame

Defined in: eigen-server/packages/kernel/dist/index.d.ts:115

One seat's projected frame, tagged with its seat. The host stamps
version/timing when it persists and fans these out.

#### Properties

##### data

```ts
data: JsonObject;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:117

##### pending\_players

```ts
pending_players: number[];
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:118

##### player\_index

```ts
player_index: number;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:116

***

### RatingPoolCase

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:105](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L105)

A `ratingPool` predicate case. Omitted timing fields mean null.

#### Properties

##### access

```ts
access: GameAccess;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:108](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L108)

##### budgetSeconds?

```ts
optional budgetSeconds?: number | null;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:110](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L110)

##### config

```ts
config: JsonObject;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:114](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L114)

##### expected

```ts
expected: string | null;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:115](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L115)

##### incrementSeconds?

```ts
optional incrementSeconds?: number | null;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:111](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L111)

##### kind

```ts
kind: "ratingPool";
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:106](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L106)

##### maxPlayers

```ts
maxPlayers: number;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:113](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L113)

##### minPlayers

```ts
minPlayers: number;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:112](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L112)

##### name

```ts
name: string;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:107](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L107)

##### turnSeconds?

```ts
optional turnSeconds?: number | null;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:109](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L109)

***

### Rejected

Defined in: eigen-server/packages/kernel/dist/index.d.ts:45

An intent the kernel refused. A value, not a throw — rejections are part
of the normal protocol.

#### Properties

##### code

```ts
code: RejectCode;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:47

##### message

```ts
message: string;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:48

##### rejected

```ts
rejected: true;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:46

***

### Seat

Defined in: eigen-server/packages/kernel/dist/index.d.ts:238

One seat of the roster. Both ids null ⇒ the account was purged mid-game
(the seat plays on as "Deleted User" for display, but can never act).

#### Properties

##### bot\_id

```ts
bot_id: string | null;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:241

##### player\_index

```ts
player_index: number;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:239

##### type

```ts
type: "bot" | "human";
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:242

##### user\_id

```ts
user_id: string | null;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:240

***

### SeatView

Defined in: eigen-server/packages/kernel/dist/index.d.ts:93

A seat's stored projection at one version — what the same-view compare
runs on (and what the DO persists per transition as `frames[]`).

#### Properties

##### data

```ts
data: JsonObject;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:94

##### pending\_players

```ts
pending_players: number[];
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:95

***

### StateRow

Defined in: eigen-server/packages/kernel/dist/index.d.ts:246

The latest committed transition — state plus the engine-owned clocks. All
instants are epoch milliseconds.

#### Properties

##### deadline

```ts
deadline: number | null;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:253

The true turn deadline shown to clients; the alarm arms at
`deadline + grace`.

##### pending

```ts
pending: number[];
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:249

##### playerTimes

```ts
playerTimes: number[] | null;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:255

Per-seat budget banks (ms), budget mode only.

##### rngSeed

```ts
rngSeed: string;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:250

##### state

```ts
state: JsonObject;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:248

##### turnStartedAt

```ts
turnStartedAt: number | null;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:256

##### version

```ts
version: number;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:247

***

### TwinFixtureFile

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:76](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L76)

One fixture file: cases targeting one `schema_version` unit.

#### Properties

##### cases

```ts
cases: TwinFixtureCase[];
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:78](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L78)

##### schemaVersion

```ts
schemaVersion: number;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:77](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L77)

## Type Aliases

### Effect

```ts
type Effect = 
  | {
  bot_id: string;
  kind: "wake_bot";
  seat: number;
}
  | {
  kind: "notify_turn";
  seat: number;
  user_id: string;
}
  | {
  kind: "notify_finished";
  user_ids: string[];
};
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:340

A push/wake the host should attempt post-commit (single attempt + error
log — no retry machinery in v1). The kernel names seats; the host resolves
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
  type: "forfeit" | "auto_forfeit";
};
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:260

What the host asks the kernel to do — the kernel-facing half of a
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

The raw move payload — parsed against the unit's action schema.

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
  type: "forfeit" | "auto_forfeit";
}
```

`forfeit` = a voluntary resign (a user action); `auto_forfeit` = the
engine-driven variant (account purge; identity-less system action).

***

### RejectCode

```ts
type RejectCode = 
  | "not_active"
  | "not_ready"
  | "expired"
  | "not_pending"
  | "state_updated"
  | "invalid_payload"
  | "illegal_move"
  | "abstain";
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:24

Why an intent was refused. Stable machine codes — the host's transport
mapping and the client's retry policy key on these, so treat renames as
breaking.

***

### TwinFixtureCase

```ts
type TwinFixtureCase = 
  | ActionCase
  | RatingPoolCase
  | BotSeatableCase;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:127](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L127)

## Functions

### commit()

```ts
function commit(input): CommitPlan | Rejected;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:373

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

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:481](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L481)

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

Defined in: eigen-server/packages/kernel/dist/index.d.ts:389

The deterministic RNG for one transition: rand-seed's sfc32 keyed by the
game's base seed and the state version the envelope will commit as. The
same `(seed, version)` always yields the same draw sequence — a replay
re-derives it — and every transition gets an independent stream, so hooks
draw as many values as they need with no cross-invocation state. Identical
derivation to the Supabase-era engine, so recorded games stay replayable.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `seed` | `string` |
| `version` | `number` |

#### Returns

`Rng`

***

### evaluateTwinCase()

```ts
function evaluateTwinCase(rules, kase): string[];
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:275](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L275)

Run one fixture case against a rules unit, returning failure descriptions
(empty ⇒ the case passes). Pure — the file-reading test registrar is
[twinFixtureTests](#twinfixturetests).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `rules` | `GameRules` |
| `kase` | [`TwinFixtureCase`](#twinfixturecase) |

#### Returns

`string`[]

***

### isRejected()

```ts
function isRejected(result): result is Rejected;
```

Defined in: eigen-server/packages/kernel/dist/index.d.ts:372

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

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:248](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L248)

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

Defined in: [eigen-server/packages/testkit/src/kernel-scenarios.ts:39](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/kernel-scenarios.ts#L39)

Project one seat's view of a state — the stored-frame shape the same-view
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

Defined in: eigen-server/packages/kernel/dist/index.d.ts:382

A fresh base seed for a new game: 128 random bits, hex-encoded. Stored on
the game's v0 state row and copied onto every later row (server-only —
never expose it: the whole randomness of the game is derivable from it).

#### Returns

`string`

***

### twinFixtureTests()

```ts
function twinFixtureTests(gameModule, fixturesRoot): void;
```

Defined in: [eigen-server/packages/testkit/src/twin-fixtures.ts:291](https://github.com/eigeninteractive/eigen-server/blob/a8d4d3e7091c01d99bac986af11b200eb19a04b8/packages/testkit/src/twin-fixtures.ts#L291)

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
