# @eigeninteractive/kernel

`@eigeninteractive/kernel`: the pure decision core. Given the current row, a state
snapshot and an intent, it returns a plan: the next state, the transition to
append, the observations to fan out, and any effects to schedule. It touches
no storage and no clock of its own, so every decision is reproducible from
its inputs alone.

## Classes

### GameBugError

Defined in: [eigen-server/packages/kernel/src/errors.ts:15](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/errors.ts#L15)

A broken game/engine invariant: a bug, not a rejection.

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new GameBugError(message?): GameBugError;
```

Defined in: eigen-web/node\_modules/.pnpm/typescript@6.0.3/node\_modules/typescript/lib/lib.es5.d.ts:1080

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `message?` | `string` |

###### Returns

[`GameBugError`](#gamebugerror)

###### Inherited from

```ts
Error.constructor
```

##### Constructor

```ts
new GameBugError(message?, options?): GameBugError;
```

Defined in: eigen-web/node\_modules/.pnpm/typescript@6.0.3/node\_modules/typescript/lib/lib.es5.d.ts:1080

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `message?` | `string` |
| `options?` | `ErrorOptions` |

###### Returns

[`GameBugError`](#gamebugerror)

###### Inherited from

```ts
Error.constructor
```

## Interfaces

### CommitInput

Defined in: [eigen-server/packages/kernel/src/commit.ts:96](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L96)

#### Properties

##### game

```ts
game: GameRow;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:97](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L97)

##### intent

```ts
intent: Intent;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:102](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L102)

##### now

```ts
now: number;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:105](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L105)

The commit instant (epoch ms), sampled once by the host and never read
here.

##### roster

```ts
roster: Seat[];
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:101](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L101)

##### rules

```ts
rules: GameRules;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:108](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L108)

The version unit for the game's `schemaVersion`, already resolved by
the host from the `GameModule.versions` map.

##### staleViews?

```ts
optional staleViews?: {
  current: SeatView | null;
  expected: SeatView | null;
};
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:116](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L116)

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

Defined in: [eigen-server/packages/kernel/src/commit.ts:100](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L100)

The latest transition, or null before v0 (only a `start` intent is
meaningful then).

***

### CommitPlan

Defined in: [eigen-server/packages/kernel/src/commit.ts:139](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L139)

#### Properties

##### action

```ts
action: TransitionAction | null;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:142](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L142)

##### alarm

```ts
alarm: number | null;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:155](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L155)

The instant the DO must arm its alarm at, the true deadline plus the
grace window, or null to clear it.

##### effects

```ts
effects: Effect[];
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:156](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L156)

##### frames

```ts
frames: ObservationFrame[];
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:145](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L145)

Per-seat projected frames (identified seats only), persisted with the
transition, fanned out over sockets. No raw state escapes the kernel.

##### nextState

```ts
nextState: StateRow;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:141](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L141)

The next transition row, already versioned (`v+1`, or 0 for start).

##### outcomes

```ts
outcomes: OutcomeEntry[] | null;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:152](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L152)

Per-seat results when this transition ends the game, else null.

Rating deltas are deliberately NOT here: they depend on global cross-game
priors (D1-domain data the kernel must never need). The D1 applier
computes them inside the rating CAS via `computeRatings` (ratings.ts) and
the host delivers them as a follow-up versioned ratings transition.

***

### GameRow

Defined in: [eigen-server/packages/kernel/src/commit.ts:32](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L32)

The game's standing configuration: the DO `meta` snapshot.

#### Properties

##### budgetSeconds

```ts
budgetSeconds: number | null;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:39](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L39)

##### config

```ts
config: JsonObject;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:37](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L37)

Stored creation config; parsed against the version unit's config schema
before any hook sees it.

##### incrementSeconds

```ts
incrementSeconds: number | null;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:40](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L40)

##### rated

```ts
rated: boolean;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:41](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L41)

##### ratingPool

```ts
ratingPool: string | null;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:42](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L42)

##### schemaVersion

```ts
schemaVersion: number;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:34](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L34)

##### status

```ts
status: GameStatus;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:33](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L33)

##### turnSeconds

```ts
turnSeconds: number | null;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:38](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L38)

***

### NextDeadline

Defined in: [eigen-server/packages/kernel/src/timing.ts:48](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/timing.ts#L48)

#### Properties

##### deadline

```ts
deadline: number | null;
```

Defined in: [eigen-server/packages/kernel/src/timing.ts:49](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/timing.ts#L49)

##### turnStartedAt

```ts
turnStartedAt: number | null;
```

Defined in: [eigen-server/packages/kernel/src/timing.ts:50](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/timing.ts#L50)

***

### ObservationFrame

Defined in: [eigen-server/packages/kernel/src/observe.ts:12](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/observe.ts#L12)

One seat's projected frame, tagged with its seat. The host stamps
version/timing when it persists and fans these out.

#### Properties

##### data

```ts
data: JsonObject;
```

Defined in: [eigen-server/packages/kernel/src/observe.ts:14](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/observe.ts#L14)

##### pendingPlayers

```ts
pendingPlayers: number[];
```

Defined in: [eigen-server/packages/kernel/src/observe.ts:15](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/observe.ts#L15)

##### playerIndex

```ts
playerIndex: number;
```

Defined in: [eigen-server/packages/kernel/src/observe.ts:13](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/observe.ts#L13)

***

### PlayerInput

Defined in: [eigen-server/packages/kernel/src/ratings.ts:26](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L26)

A player seat to be rated. Self-contained: each seat's current
`mu`/`sigma` is bundled, so this module never reads a store.
`displayRating` is intentionally NOT carried; it is derived from
`mu`/`sigma` so the formula lives in one place per side of the wire.

#### Extends

- `Rating`

#### Properties

##### botId

```ts
botId: string | null;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:29](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L29)

##### placement

```ts
placement: number;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:31](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L31)

Ordinal finish rank (1 = best); ties share the same value.

##### playerIndex

```ts
playerIndex: number;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:27](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L27)

##### teamIndex

```ts
teamIndex: number;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:34](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L34)

Players sharing a teamIndex are rated as one team. For individual
games this equals playerIndex.

##### userId

```ts
userId: string | null;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:28](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L28)

***

### RatingDelta

Defined in: [eigen-server/packages/kernel/src/ratings.ts:54](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L54)

One rated identity's before → after, exactly the rating_history row minus
store keys. Computed by the D1 applier inside the rating CAS and delivered
on the post-finish ratings transition (the `kind: "ratings"` action).

#### Properties

##### displayAfter

```ts
displayAfter: number;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:62](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L62)

##### displayBefore

```ts
displayBefore: number;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:59](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L59)

##### displayChange

```ts
displayChange: number;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:63](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L63)

##### identity

```ts
identity: RatingIdentity;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:55](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L55)

##### muAfter

```ts
muAfter: number;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:60](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L60)

##### muBefore

```ts
muBefore: number;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:57](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L57)

##### pool

```ts
pool: string;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:56](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L56)

##### sigmaAfter

```ts
sigmaAfter: number;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:61](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L61)

##### sigmaBefore

```ts
sigmaBefore: number;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:58](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L58)

***

### RatingResult

Defined in: [eigen-server/packages/kernel/src/ratings.ts:47](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L47)

One identity's newly computed rating: the pure OpenSkill posterior,
before the store-owned CAS revision is attached by the applier.

#### Extends

- `Rating`

#### Properties

##### identity

```ts
identity: RatingIdentity;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:48](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L48)

***

### Rejected

Defined in: [eigen-server/packages/kernel/src/errors.ts:42](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/errors.ts#L42)

An intent the kernel refused. A value, not a throw: rejections are part
of the normal protocol.

#### Properties

##### code

```ts
code: RejectCode;
```

Defined in: [eigen-server/packages/kernel/src/errors.ts:44](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/errors.ts#L44)

##### message

```ts
message: string;
```

Defined in: [eigen-server/packages/kernel/src/errors.ts:45](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/errors.ts#L45)

##### rejected

```ts
rejected: true;
```

Defined in: [eigen-server/packages/kernel/src/errors.ts:43](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/errors.ts#L43)

***

### Seat

Defined in: [eigen-server/packages/kernel/src/commit.ts:47](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L47)

One seat of the roster. Both ids null ⇒ the account was purged mid-game
(the seat plays on as "Deleted User" for display, but can never act).

#### Properties

##### botId

```ts
botId: string | null;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:50](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L50)

##### playerIndex

```ts
playerIndex: number;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:48](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L48)

##### type

```ts
type: "bot" | "human";
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:51](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L51)

##### userId

```ts
userId: string | null;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:49](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L49)

***

### SeatView

Defined in: [eigen-server/packages/kernel/src/guards.ts:86](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/guards.ts#L86)

A seat's stored projection at one version: what the same-view compare
runs on (and what the DO persists per transition as `frames[]`).

#### Properties

##### data

```ts
data: JsonObject;
```

Defined in: [eigen-server/packages/kernel/src/guards.ts:87](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/guards.ts#L87)

##### pendingPlayers

```ts
pendingPlayers: number[];
```

Defined in: [eigen-server/packages/kernel/src/guards.ts:88](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/guards.ts#L88)

***

### StateRow

Defined in: [eigen-server/packages/kernel/src/commit.ts:56](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L56)

The latest committed transition: state plus the engine-owned clocks. All
instants are epoch milliseconds.

#### Properties

##### deadline

```ts
deadline: number | null;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:63](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L63)

The true turn deadline shown to clients; the alarm arms at
`deadline + grace`.

##### pending

```ts
pending: number[];
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:59](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L59)

##### playerTimes

```ts
playerTimes: number[] | null;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:65](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L65)

Per-seat budget banks (ms), budget mode only.

##### rngSeed

```ts
rngSeed: string;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:60](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L60)

##### state

```ts
state: JsonObject;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:58](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L58)

##### turnStartedAt

```ts
turnStartedAt: number | null;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:66](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L66)

##### version

```ts
version: number;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:57](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L57)

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

Defined in: [eigen-server/packages/kernel/src/commit.ts:137](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L137)

A push/wake the host should attempt post-commit (single attempt + error
log, with no retry machinery in v1). The kernel names seats; the host resolves
delivery (FCM targets, bot webhook vs local bot).

***

### GameStatus

```ts
type GameStatus = "waiting" | "ready" | "active" | "finished" | "aborted";
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:29](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L29)

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

Defined in: [eigen-server/packages/kernel/src/commit.ts:73](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L73)

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

### ParseResult

```ts
type ParseResult<T> =
  | {
  ok: true;
  value: T;
}
  | {
  message: string;
  ok: false;
};
```

Defined in: [eigen-server/packages/kernel/src/schema.ts:13](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/schema.ts#L13)

A client payload parse: refusal is the caller's fault, so failure comes
back as a value for `commit()` to turn into a rejection.

#### Type Parameters

| Type Parameter |
| ------ |
| `T` |

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

Defined in: [eigen-server/packages/kernel/src/errors.ts:20](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/errors.ts#L20)

Why an intent was refused. Stable machine codes: the host's transport
mapping and the client's retry policy key on these, so treat renames as
breaking.

***

### TransitionAction

```ts
type TransitionAction =
  | {
  data: JsonObject;
  kind: "game";
  playerIndex: number;
  type: "user" | "bot";
}
  | {
  data: LifecycleAction;
  kind: "lifecycle";
  playerIndex: number | null;
  type: ActionType;
}
  | {
  data: {
     deltas: RatingDelta[];
  };
  kind: "ratings";
  playerIndex: null;
  type: "system";
};
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:132](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L132)

The action-log entry for a transition. Null only for the start transition
(v0), which no action produced. `playerIndex` is the performer's seat, and
null for identity-less system actions (timeout, auto-forfeit).

The `ratings` variant is engine-owned, never produced by `commit()`: the
host appends it as the post-finish ratings transition (step 3) once
the D1 apply returns the deltas. Game hooks never see it; its data is the
engine's, not the game's opaque payload.

## Variables

### DEADLINE\_GRACE\_MS

```ts
const DEADLINE_GRACE_MS: 750 = 750;
```

Defined in: [eigen-server/packages/kernel/src/timing.ts:25](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/timing.ts#L25)

Grace window (ms) added to every deadline comparison so a player who
submits on time is not rejected because network latency carried the request
past the deadline. Keep it small relative to per-action `turnSeconds`
windows. The client's display-only `kServerDeadlineGrace` mirrors this.

## Functions

### assertBudgetPending()

```ts
function assertBudgetPending(
   budgetSeconds,
   envelope,
   schemaVersion): void;
```

Defined in: [eigen-server/packages/kernel/src/guards.ts:26](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/guards.ts#L26)

Enforce budget mode's sequential-pending rule at the source: an
accumulated clock only meters individual thinking time when at most one
seat drains it, so a hook returning a multi-seat pending set in a
budget-timed game is a game bug. `computeNextDeadline`'s MIN-over-pending
remains the graceful-degradation safeguard should such a state ever be
reached. No-op when the game has no budget clock.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `budgetSeconds` | `number` \| `null` |
| `envelope` | `Envelope` |
| `schemaVersion` | `number` |

#### Returns

`void`

***

### assertForfeitPending()

```ts
function assertForfeitPending(
   targetSeat,
   envelope,
   schemaVersion): void;
```

Defined in: [eigen-server/packages/kernel/src/guards.ts:36](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/guards.ts#L36)

Enforce that a forfeit actually removes the forfeited seat: a hook that
leaves `targetSeat` in the pending set is a game bug. Left uncaught, the
account-deletion purge would turn that seat into a ghost: no identity, yet
still holding a deadline the timeout alarm fires at forever.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `targetSeat` | `number` |
| `envelope` | `Envelope` |
| `schemaVersion` | `number` |

#### Returns

`void`

***

### assertHookPayload()

```ts
function assertHookPayload<T>(
   schema,
   value,
   what): asserts value is T;
```

Defined in: [eigen-server/packages/kernel/src/schema.ts:63](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/schema.ts#L63)

Validate a payload produced by a game hook. Unlike client parsing, a
failure is always a game bug. Validate-only: callers retain the hook's
original object so a schema library cannot silently normalize or strip a
value on the game's behalf.

#### Type Parameters

| Type Parameter |
| ------ |
| `T` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `schema` | `StandardSchemaV1`\<`unknown`, `T`\> |
| `value` | `unknown` |
| `what` | `string` |

#### Returns

`asserts value is T`

***

### assertHookState()

```ts
function assertHookState(
   schemas,
   envelope,
   schemaVersion): void;
```

Defined in: [eigen-server/packages/kernel/src/guards.ts:16](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/guards.ts#L16)

Validate the state a hook returned against the game's version schema
before it is committed, catching a hook that wrote a malformed or
wrong-version shape at the source instead of on the next read.
Validate-only: the original envelope object is what gets persisted.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `schemas` | `GameSchemas` |
| `envelope` | `Envelope` |
| `schemaVersion` | `number` |

#### Returns

`void`

***

### assertPendingIdentified()

```ts
function assertPendingIdentified(
   roster,
   envelope,
   schemaVersion): void;
```

Defined in: [eigen-server/packages/kernel/src/guards.ts:48](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/guards.ts#L48)

Enforce that every pending seat has someone behind it: a seat whose
account was purged mid-game (both ids null) can never act, so a hook that
returns it as pending is a game bug, typically rules deriving pending from
the participant count instead of from who is still in the game. Backstop to
[assertForfeitPending](#assertforfeitpending): that one catches the forfeit itself; this one
catches any later hook resurrecting the seat.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `roster` | readonly \{ `botId`: `string` \| `null`; `playerIndex`: `number`; `userId`: `string` \| `null`; \}[] |
| `envelope` | `Envelope` |
| `schemaVersion` | `number` |

#### Returns

`void`

***

### canonicalJson()

```ts
function canonicalJson(value): string;
```

Defined in: [eigen-server/packages/kernel/src/guards.ts:69](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/guards.ts#L69)

Canonical JSON: deterministic serialization with object keys sorted and
`undefined` object values treated as absent, so two structurally equal
views compare byte-identical regardless of construction order.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `value` | `Json` \| `undefined` |

#### Returns

`string`

***

### commit()

```ts
function commit(input): CommitPlan | Rejected;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:166](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L166)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `input` | [`CommitInput`](#commitinput) |

#### Returns

[`CommitPlan`](#commitplan) \| [`Rejected`](#rejected)

***

### computeNextDeadline()

```ts
function computeNextDeadline(input): NextDeadline;
```

Defined in: [eigen-server/packages/kernel/src/timing.ts:67](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/timing.ts#L67)

Computes the deadline and `turnStartedAt` for the next action: the
precedence chain used by start and every commit mode. Pass
`gameOver = true` when the transition ends the game.

1. game over → both null
2. hook returned `turnSeconds` N → now + N s (banks untouched)
3. budget mode → now + MIN remaining bank over the new pending set
4. per-action mode → now + configured `turnSeconds`
5. untimed → both null

Budget mode allows at most one pending seat, enforced at the source by
`assertBudgetPending` before any envelope reaches this; the MIN remains the
graceful-degradation safeguard should a multi-pending state arrive anyway.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `input` | \{ `actionSeconds`: `number` \| `null`; `budgetSeconds`: `number` \| `null`; `gameOver`: `boolean`; `newPending`: readonly `number`[]; `newPlayerTimes`: readonly `number`[] \| `null`; `now`: `number`; `turnSeconds`: `number` \| `null`; \} | - |
| `input.actionSeconds` | `number` \| `null` | The hook's per-action override (envelope `turnSeconds`), else null. |
| `input.budgetSeconds` | `number` \| `null` | - |
| `input.gameOver` | `boolean` | - |
| `input.newPending` | readonly `number`[] | - |
| `input.newPlayerTimes` | readonly `number`[] \| `null` | - |
| `input.now` | `number` | - |
| `input.turnSeconds` | `number` \| `null` | - |

#### Returns

[`NextDeadline`](#nextdeadline)

***

### computeRatings()

```ts
function computeRatings(players): RatingResult[];
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:196](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L196)

Compute every identity's new rating for one finished game.

Exactly one result per identity, humans and bots alike, matching the one
rating row per (game, identity) the store keeps. The field is rated once;
single-seat identities read their posterior straight from that rating,
while a multi-seat identity is re-rated seat-by-seat into a single net
result (see `multiSeatUpdate`). The single full-field `rate()` is
what every single-seat player is scored against, so a human who faced a
two-seat bot is correctly rated against two distinct opponents.

A seat with no identity, because its account was purged mid-game, stays in the
field (opponents' posteriors must account for everyone they actually faced,
at that seat's supplied baseline) but yields no result: there is no rating
row left to update.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `players` | [`PlayerInput`](#playerinput)[] |

#### Returns

[`RatingResult`](#ratingresult)[]

***

### deadlineExpired()

```ts
function deadlineExpired(deadline, now): boolean;
```

Defined in: [eigen-server/packages/kernel/src/timing.ts:30](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/timing.ts#L30)

TRUE once a turn deadline (plus the grace window) has genuinely passed,
measured against the injected `now`. A null deadline (untimed turn) is
never expired.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `deadline` | `number` \| `null` |
| `now` | `number` |

#### Returns

`boolean`

***

### deductBank()

```ts
function deductBank(
   playerTimes,
   playerIndex,
   now,
   turnStartedAt,
   incrementSeconds): number[];
```

Defined in: [eigen-server/packages/kernel/src/timing.ts:38](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/timing.ts#L38)

Deducts the acting player's elapsed thinking time from their budget bank
and applies the Fischer increment. Returns a new `playerTimes` array (ms
banks, one per seat). Floored at 0: a player who overran their bank lands
at 0, not negative.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `playerTimes` | readonly `number`[] |
| `playerIndex` | `number` |
| `now` | `number` |
| `turnStartedAt` | `number` \| `null` |
| `incrementSeconds` | `number` \| `null` |

#### Returns

`number`[]

***

### defaultRating()

```ts
function defaultRating(): Rating;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:73](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L73)

The OpenSkill prior for a never-rated identity.

#### Returns

`Rating`

***

### deriveRng()

```ts
function deriveRng(seed, version): Rng;
```

Defined in: [eigen-server/packages/kernel/src/rng.ts:29](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/rng.ts#L29)

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

### displayRating()

```ts
function displayRating(mu, sigma): number;
```

Defined in: [eigen-server/packages/kernel/src/ratings.ts:68](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/ratings.ts#L68)

max(0, round((mu − 3σ) · 40)): the one server-side home of the display
formula (the client mirrors it for optimistic display only).

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `mu` | `number` |
| `sigma` | `number` |

#### Returns

`number`

***

### fanOutObservations()

```ts
function fanOutObservations(rules, args): ObservationFrame[];
```

Defined in: [eigen-server/packages/kernel/src/observe.ts:25](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/observe.ts#L25)

Project the new state into one slice per seat: the eager fan-out the host
persists per transition (frames serve live delivery and the same-view
compare, so they stay eager). `rules` is the game's own version unit,
already resolved by the caller. `args` is the hook's own contract minus the
per-seat `playerIndex`, which the loop supplies; the body still forwards
each field explicitly so a new hook arg forces a per-seat-or-shared
decision here.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `rules` | `GameRules` |
| `args` | `Omit`\<`ComputeObservationArgs`, `"playerIndex"`\> |

#### Returns

[`ObservationFrame`](#observationframe)[]

***

### isRejected()

```ts
function isRejected(result): result is Rejected;
```

Defined in: [eigen-server/packages/kernel/src/commit.ts:160](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/commit.ts#L160)

Type guard: did `commit()` refuse the intent?

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `result` | [`CommitPlan`](#commitplan) \| [`Rejected`](#rejected) |

#### Returns

`result is Rejected`

***

### parseClientPayload()

```ts
function parseClientPayload<T>(
   schema,
   value,
what): ParseResult<T>;
```

Defined in: [eigen-server/packages/kernel/src/schema.ts:40](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/schema.ts#L40)

Parse a client-submitted payload (an action's `data`, a create request's
`config`) through its schema. Failure is the caller's fault. Returns the
parsed value, so what flows onward, into hooks and the action log, is the
sanitized shape (unknown keys stripped, defaults applied), never the raw
submission.

#### Type Parameters

| Type Parameter |
| ------ |
| `T` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `schema` | `StandardSchemaV1`\<`unknown`, `T`\> |
| `value` | `unknown` |
| `what` | `string` |

#### Returns

[`ParseResult`](#parseresult)\<`T`\>

***

### parseStoredPayload()

```ts
function parseStoredPayload<T>(
   schema,
   value,
   what,
   schemaVersion): T;
```

Defined in: [eigen-server/packages/kernel/src/schema.ts:51](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/schema.ts#L51)

Parse a stored payload (a state row, the game's config) through its
schema. Failure means corrupted data or a schema that no longer matches
what this version historically wrote: an engine-side bug, thrown.

#### Type Parameters

| Type Parameter |
| ------ |
| `T` |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `schema` | `StandardSchemaV1`\<`unknown`, `T`\> |
| `value` | `unknown` |
| `what` | `string` |
| `schemaVersion` | `number` |

#### Returns

`T`

***

### randomSeed()

```ts
function randomSeed(): string;
```

Defined in: [eigen-server/packages/kernel/src/rng.ts:18](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/rng.ts#L18)

A fresh base seed for a new game: 128 random bits, hex-encoded. Stored on
the game's v0 state row and copied onto every later row (server-only,
never expose it: the whole randomness of the game is derivable from it).

#### Returns

`string`

***

### reject()

```ts
function reject(code, message): Rejected;
```

Defined in: [eigen-server/packages/kernel/src/errors.ts:48](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/errors.ts#L48)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `code` | [`RejectCode`](#rejectcode) |
| `message` | `string` |

#### Returns

[`Rejected`](#rejected)

***

### sameView()

```ts
function sameView(a, b): boolean;
```

Defined in: [eigen-server/packages/kernel/src/guards.ts:100](https://github.com/eigeninteractive/eigen-server/blob/4efa591cb75546194a4a6bc8ed984bf78c9cf782/packages/kernel/src/guards.ts#L100)

The same-view rule: a stale-`expectedVersion` action is accepted
iff the acting seat's own projected observation (slice `data` plus the
seat's *observed* pending set) is identical between the expected and
current versions, ignoring version/timing bookkeeping. Identical view ⇒ the
intent transfers soundly (and `applyAction` still validates legality
against the true current state); changed view ⇒ the conflict is genuine and
"state updated" is literally true. The implementor controls this policy
implicitly through `computeObservation`: reveal an event and it invalidates
pending stale submissions; hide it and they survive.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `a` | [`SeatView`](#seatview) |
| `b` | [`SeatView`](#seatview) |

#### Returns

`boolean`
