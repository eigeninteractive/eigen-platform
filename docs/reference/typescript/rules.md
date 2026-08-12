# @eigeninteractive/rules

`@eigeninteractive/rules`: the contract a game implements. A `GameModule` bundles one
`GameRules` unit per schema version; the engine calls its hooks and never
inspects game state directly. This package is types plus a couple of
helpers: it has no runtime dependencies and pulls in no engine code.

## Classes

### IllegalMoveError

Defined in: [eigen-server/packages/rules/src/helpers.ts:14](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/helpers.ts#L14)

Thrown by a game's `applyAction` to reject a move that breaks the rules.
the *expected* failure of the hook (a mis-tap, a client bug), rendered to
the caller as their error. Anything else a hook throws is treated as a game
bug and surfaces as a server error. Domain-level on purpose: the game
states "this move is illegal", the engine owns the transport mapping.

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new IllegalMoveError(message?): IllegalMoveError;
```

Defined in: eigen-web/node\_modules/.pnpm/typescript@6.0.3/node\_modules/typescript/lib/lib.es5.d.ts:1080

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `message?` | `string` |

###### Returns

[`IllegalMoveError`](#illegalmoveerror)

###### Inherited from

```ts
Error.constructor
```

##### Constructor

```ts
new IllegalMoveError(message?, options?): IllegalMoveError;
```

Defined in: eigen-web/node\_modules/.pnpm/typescript@6.0.3/node\_modules/typescript/lib/lib.es5.d.ts:1080

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `message?` | `string` |
| `options?` | `ErrorOptions` |

###### Returns

[`IllegalMoveError`](#illegalmoveerror)

###### Inherited from

```ts
Error.constructor
```

## Interfaces

### ApplyActionArgs

Defined in: [eigen-server/packages/rules/src/contract.ts:122](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L122)

#### Extends

- `HookContext`\<`TConfig`\>

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TState` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |
| `TAction` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |
| `TConfig` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |

#### Properties

##### config

```ts
config: TConfig;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:113](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L113)

###### Inherited from

```ts
HookContext.config
```

##### data

```ts
data: TAction;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:125](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L125)

##### pending

```ts
pending: number[];
```

Defined in: [eigen-server/packages/rules/src/contract.ts:124](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L124)

##### playerIndex

```ts
playerIndex: number;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:126](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L126)

##### rng

```ts
rng: Rng;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:128](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L128)

Deterministic per-transition RNG. See [Rng](#rng-4).

##### state

```ts
state: TState;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:123](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L123)

***

### ApplyLifecycleArgs

Defined in: [eigen-server/packages/rules/src/contract.ts:140](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L140)

#### Extends

- `HookContext`\<`TConfig`\>

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TState` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |
| `TConfig` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |

#### Properties

##### config

```ts
config: TConfig;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:113](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L113)

###### Inherited from

```ts
HookContext.config
```

##### data

```ts
data: LifecycleAction;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:149](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L149)

##### pending

```ts
pending: number[];
```

Defined in: [eigen-server/packages/rules/src/contract.ts:146](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L146)

Seats awaiting an action. For `timeout` these are exactly the seats that
ran out of time, so resolve the whole set in one envelope (you may declare a
draw). For `forfeit`/`autoForfeit`, the target seat is in
`data.playerIndex`.

##### rng

```ts
rng: Rng;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:151](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L151)

Deterministic per-transition RNG. See [Rng](#rng-4).

##### state

```ts
state: TState;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:141](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L141)

##### type

```ts
type: LifecycleType;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:148](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L148)

The trigger, always equal to `data.type`.

***

### BotActionArgs

Defined in: [eigen-server/packages/rules/src/contract.ts:221](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L221)

A seated engine bot's turn to move, passed to the matching entry in
[GameRules.botActions](#botactions). The brain runs inside the game's Durable
Object post-commit and sees exactly what a human at this seat would
(`observation`, the same fog-of-war projection, so a bot cannot read hidden
state its seat may not); `botConfig` is that bot registry row's declared
knob (difficulty, personality). The engine self-applies the returned move as
this seat's action, validated against `schemas.action` exactly like a human
move. `rng` is deterministic per (game, version, seat) for reproducible
tests, but the chosen move is what gets logged, so the brain need not be
pure (replay uses the recorded action, never re-runs the brain).

#### Extends

- `HookContext`\<`TConfig`\>

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TObservation` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |
| `TConfig` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |

#### Properties

##### botConfig

```ts
botConfig: JsonObject;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:223](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L223)

##### config

```ts
config: TConfig;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:113](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L113)

###### Inherited from

```ts
HookContext.config
```

##### observation

```ts
observation: ObservationSlice<TObservation>;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:222](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L222)

##### playerIndex

```ts
playerIndex: number;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:224](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L224)

##### rng

```ts
rng: Rng;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:225](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L225)

***

### BotSeatableArgs

Defined in: [eigen-server/packages/rules/src/contract.ts:206](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L206)

A candidate bot seating, passed to [GameRules.botSeatable](#botseatable).
`gameConfig` is parsed against the game's version schema; `botConfig` is the
bot's declared capabilities: game-owned but unversioned by the game
schemas, so it stays opaque.

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TConfig` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |

#### Properties

##### botConfig

```ts
botConfig: JsonObject;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:208](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L208)

##### gameConfig

```ts
gameConfig: TConfig;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:207](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L207)

***

### ComputeObservationArgs

Defined in: [eigen-server/packages/rules/src/contract.ts:170](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L170)

#### Extends

- `HookContext`\<`TConfig`\>

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TState` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |
| `TAction` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |
| `TConfig` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |

#### Properties

##### cause

```ts
cause: TransitionCause<TAction>;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:182](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L182)

What produced `state`. See [TransitionCause](#transitioncause). Shared across the
per-seat fan-out; per-seat filtering of what it reveals is this hook's
job.

##### config

```ts
config: TConfig;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:113](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L113)

###### Inherited from

```ts
HookContext.config
```

##### isReplay

```ts
isReplay: boolean;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:185](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L185)

TRUE only when projecting a finished game for replay, where hidden-info games
may reveal opponent state.

##### participantCount

```ts
participantCount: number;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:178](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L178)

##### pending

```ts
pending: number[];
```

Defined in: [eigen-server/packages/rules/src/contract.ts:172](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L172)

##### playerIndex

```ts
playerIndex: number | null;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:177](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L177)

The seat this projection is for, or `null` for a viewer (a non-participant
replaying a public game). A viewer projection only ever occurs with
`isReplay` true (a public finished game), so a game may safely reveal the
full post-game view for it.

##### state

```ts
state: TState;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:171](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L171)

***

### Envelope

Defined in: [eigen-server/packages/rules/src/contract.ts:81](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L81)

The result of advancing the game by one transition: the return of
`initialState`, `applyAction`, and `applyLifecycle`.

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TState` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |

#### Properties

##### outcome?

```ts
optional outcome?: OutcomeEntry[];
```

Defined in: [eigen-server/packages/rules/src/contract.ts:89](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L89)

Present **only** when the game ends. Absent/undefined means ongoing.

##### pendingPlayers

```ts
pendingPlayers: number[];
```

Defined in: [eigen-server/packages/rules/src/contract.ts:87](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L87)

0-based seats that may act next. Empty ⇒ game over.

##### state

```ts
state: TState;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:85](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L85)

New pure game payload (board, deck, fog…). Never carries whose-turn or
winner info; those are engine-owned fields. Must match the game's
`schemaVersion` schema, which the engine validates before committing.

##### turnSeconds?

```ts
optional turnSeconds?: number;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:92](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L92)

Optional per-action deadline override for *this action only* (does not
touch any player's bank). Omit to use the game's configured timing.

***

### GameModule

Defined in: [eigen-server/packages/rules/src/contract.ts:348](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L348)

The complete game-specific surface: the same-named twin of the Dart
`GameModule` (whose extras are client-only creation/about UI). Implement
this once per app and pass it to `createEngine`; the engine owns all
version dispatch, so every request resolves the game's `schemaVersion`
entry from [versions](#versions) and invokes that unit's hooks. Game code never
branches on version.

#### Properties

##### versions

```ts
versions: Record<number, AnyGameRules>;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:356](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L356)

The [GameRules](#gamerules) units keyed by `schemaVersion`: exactly the
versions this build ships. Sparse on purpose: game creation rejects a
version not present here, loading a stored game requires its version's
entry, and a drained old version is retired by deleting its entry. The
value type is [AnyGameRules](#anygamerules); each entry is authored against its
concrete payload types and erased here; safe because the engine parses
each payload with the same entry's schemas before invoking its hooks.

***

### GameRules

Defined in: [eigen-server/packages/rules/src/contract.ts:264](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L264)

Everything one `schemaVersion` of a game needs: the payload contracts plus
all six hooks, narrowly typed to that version's shapes.

The type parameters are the version's payload types, inferred from the
schemas in [schemas](#schemas) (`z.infer<typeof stateSchema>` etc., using `type`
aliases, not `interface`s). The engine parses every payload with this
unit's schemas before invoking its hooks, so hook bodies never see
unvalidated JSON, and never another version's shape. When rules or shapes
change incompatibly, ship a new `GameRules` under the next version key
(reusing unchanged pieces by import) instead of branching inside hooks.

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TState` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |
| `TObservation` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |
| `TAction` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |
| `TConfig` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |

#### Properties

##### botActions?

```ts
optional botActions?: Record<string, BotAction<TAction, TObservation, TConfig>>;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:319](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L319)

Optional: the in-DO bot brains, **keyed by bot username**. When a
seated `engine`-type bot's turn starts, the engine resolves its registry
row's `username`, looks the move function up here, runs it post-commit,
and self-applies the returned move, so a bot game needs no external
service. Several bots that share behaviour point their usernames at the
same function and differ by their per-row `botConfig`; distinct behaviour
is a distinct entry. A seated engine bot whose username is absent here
(or an `external` bot with no `webhook_url`) is rejected at seating. The
returned move is validated against `schemas.action` and an illegal one is
rejected exactly like a human's, so a buggy brain fails that seat's turn
(the deadline backstops it) rather than corrupting the game.

##### schemas

```ts
schemas: GameSchemas<TState, TObservation, TAction, TConfig>;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:266](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L266)

The payload contracts for this version.

#### Methods

##### applyAction()

```ts
applyAction(args): Envelope<TState>;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:277](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L277)

Apply a player's move. The engine has already confirmed it is this
seat's turn at the expected version, so do not re-check turn order. Only
validate move legality and throw [IllegalMoveError](#illegalmoveerror) if it fails;
the engine renders it as the caller's error. Any other throw is a game
bug and surfaces as a server error.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`ApplyActionArgs`](#applyactionargs)\<`TState`, `TAction`, `TConfig`\> |

###### Returns

[`Envelope`](#envelope)\<`TState`\>

##### applyLifecycle()

```ts
applyLifecycle(args): Envelope<TState>;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:284](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L284)

Resolve a lifecycle action (`forfeit`/`timeout`) into an envelope.
Lifecycle actions operate on the game from outside its rules. They may
be player-triggered (a resign) or engine-triggered (timeout, purge);
either way the consequence is the game's to decide. Unlike `applyAction`
it cannot be "illegal"; it always resolves.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`ApplyLifecycleArgs`](#applylifecycleargs)\<`TState`, `TConfig`\> |

###### Returns

[`Envelope`](#envelope)\<`TState`\>

##### botSeatable()

```ts
botSeatable(args): boolean;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:306](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L306)

Decide whether a bot's declared capabilities (`botConfig`) support a
game with `gameConfig`. The engine gates seating on this before
committing; the Dart `GameRules` twin filters the bot pickers locally.
Return `true` to allow.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`BotSeatableArgs`](#botseatableargs)\<`TConfig`\> |

###### Returns

`boolean`

##### computeObservation()

```ts
computeObservation(args): ObservationSlice<TObservation>;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:292](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L292)

Project the state into one seat's view, including what that seat may
see of the transition that produced it (`args.cause`), so the client can
animate. Perfect-info games can use the `passthroughObservation` helper
(which ignores the cause). What this hook reveals also implicitly sets
the simultaneous-move policy: a stale submission survives exactly while
the acting seat's projected view is unchanged (the same-view rule).

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`ComputeObservationArgs`](#computeobservationargs)\<`TState`, `TAction`, `TConfig`\> |

###### Returns

[`ObservationSlice`](#observationslice)\<`TObservation`\>

##### initialState()

```ts
initialState(args): Envelope<TState>;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:270](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L270)

Starting envelope. Draw any setup randomness (deck shuffle, first
player…) from `args.rng`.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`InitialStateArgs`](#initialstateargs)\<`TConfig`\> |

###### Returns

[`Envelope`](#envelope)\<`TState`\>

##### ratingPool()

```ts
ratingPool(args): string | null;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:300](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L300)

Decide whether, and in which pool, a game with these settings is
rated. Return the pool name (e.g. `'rapid'`) or `null` for unrated. The
engine computes `canBeRated = pool != null && !guest` and validates the
client's concrete `rated` assertion against it (rejecting a mismatch).
The Dart `GameRules` keeps a twin of this so the create dialog can gate
the Rated/Casual toggle and send the same value.

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`RatingPoolArgs`](#ratingpoolargs)\<`TConfig`\> |

###### Returns

`string` \| `null`

***

### GameSchemas

Defined in: [eigen-server/packages/rules/src/contract.ts:241](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L241)

The declarative payload contracts for one `schemaVersion`: the Standard
Schemas the engine uses to parse (and validate) every game payload crossing
the JSON boundary. Keep them transform-free: what parses is what persists,
and the engine re-validates hook-returned state against `state`. Schemas
must validate **synchronously** (every mainstream library does unless you
opt into async refinements); the engine rejects an async schema as a game
bug.

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TState` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |
| `TObservation` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |
| `TAction` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |
| `TConfig` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |

#### Properties

##### action

```ts
action: GamePayloadSchema<TAction>;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:247](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L247)

A player move's `data`, as submitted by clients and bots.

##### config

```ts
config: GamePayloadSchema<TConfig>;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:249](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L249)

The per-instance creation config stored on the game.

##### observation

```ts
observation: GamePayloadSchema<TObservation>;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:245](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L245)

One participant's projected view, as returned by `computeObservation`.

##### state

```ts
state: GamePayloadSchema<TState>;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:243](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L243)

The pure game payload stored per transition.

***

### InitialStateArgs

Defined in: [eigen-server/packages/rules/src/contract.ts:116](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L116)

#### Extends

- `HookContext`\<`TConfig`\>

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TConfig` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |

#### Properties

##### config

```ts
config: TConfig;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:113](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L113)

###### Inherited from

```ts
HookContext.config
```

##### playerCount

```ts
playerCount: number;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:119](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L119)

##### rng

```ts
rng: Rng;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:118](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L118)

Deterministic RNG for this transition. See [Rng](#rng-4).

***

### JsonObject

Defined in: [eigen-server/packages/rules/src/json.ts:23](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/json.ts#L23)

A JSON object: the shape of `state`, `config`, `data`, and observation
slices, and the constraint every game payload type must satisfy. An
`interface` for the same lazy-resolution reason as `JsonArray`.
Declare *game payload* types as `type` aliases (e.g. via your schema
library's inference), not `interface`s, since a payload `interface` lacks the
implicit index signature this constraint relies on.

#### Indexable

```ts
[key: string]: Json | undefined
```

***

### ObservationSlice

Defined in: [eigen-server/packages/rules/src/contract.ts:96](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L96)

One participant's view of the state, produced by `computeObservation`.

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TObservation` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |

#### Properties

##### data

```ts
data: TObservation;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:98](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L98)

What this seat is permitted to see.

##### pendingPlayers

```ts
pendingPlayers: number[];
```

Defined in: [eigen-server/packages/rules/src/contract.ts:103](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L103)

Pending set as this seat sees it. May be narrowed from the true set for
hidden-info games (e.g. a Nope window, or a simultaneous-commit round
where revealing that the opponent moved would leak information). It must
stay truthful about the seat *itself*, which the engine enforces.

***

### RatingPoolArgs

Defined in: [eigen-server/packages/rules/src/contract.ts:192](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L192)

The chosen game settings, passed to [GameRules.ratingPool](#ratingpool) at
creation so the game can decide its rating pool (or that the game is
unrated). `config` is already parsed against the requested version's config
schema.

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TConfig` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |

#### Properties

##### access

```ts
access: GameAccess;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:193](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L193)

##### budgetSeconds

```ts
budgetSeconds: number | null;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:195](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L195)

##### config

```ts
config: TConfig;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:199](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L199)

##### incrementSeconds

```ts
incrementSeconds: number | null;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:196](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L196)

##### maxPlayers

```ts
maxPlayers: number;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:198](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L198)

##### minPlayers

```ts
minPlayers: number;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:197](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L197)

##### turnSeconds

```ts
turnSeconds: number | null;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:194](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L194)

***

### Rng

Defined in: [eigen-server/packages/rules/src/contract.ts:53](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L53)

Deterministic per-transition random source, derived by the engine from the
game's stored base seed and the state version the envelope commits as. Draw
freely (`next()` → float in `[0, 1)`, stateful within the invocation);
replaying the transition re-derives the identical sequence, so the game
stays a pure function of (base seed, action log), provided the hook draws
in deterministic code order.

#### Methods

##### next()

```ts
next(): number;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:54](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L54)

###### Returns

`number`

## Type Aliases

### ActionKind

```ts
type ActionKind = "game" | "lifecycle";
```

Defined in: [eigen-server/packages/rules/src/contract.ts:43](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L43)

Which species a logged action is. Everything that transitions state is an
*action*; the two species differ by contract: a `game` action is
rules-scoped (game-defined payload, validated by `applyAction`, rejectable
as illegal), a `lifecycle` action is engine-scoped (a
[LifecycleAction](#lifecycleaction) payload, resolved unconditionally by
`applyLifecycle`). Stamped on every logged transition, so replay classifies
the log structurally, never by payload shape.

***

### ActionType

```ts
type ActionType = "user" | "bot" | "system";
```

Defined in: [eigen-server/packages/rules/src/contract.ts:34](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L34)

Who performed a logged action.

***

### AnyGameRules

```ts
type AnyGameRules = GameRules<any, any, any, any>;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:338](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L338)

A [GameRules](#gamerules) unit with its payload types erased: the type of a rules
entry once it is stored in a [GameModule.versions](#versions) registry that holds
*many* games'/versions' rules whose concrete `TState`/`TAction`/`TConfig`
genuinely differ. That container needs "a `GameRules` for *some* payload
types", an existential TypeScript cannot spell; `any` is the one sanctioned
escape for it (`unknown` cannot, since the config/action params are contravariant
input positions). It is **safe** here because the engine re-validates every
payload against that entry's own `schemas` before invoking a hook, so the
static type was only ever an authoring aid, redundant once the unit is
registered. Authors keep full type-checking by writing
`class X implements GameRules<State, Observation, Action, Config>` (or annotating a
literal `: GameRules<…>`); assigning that into a `versions` map just works,
with no `as`-cast, because `any` disables the variance check at this seam.

***

### BotAction

```ts
type BotAction<TAction, TObservation, TConfig> = (args) => TAction;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:230](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L230)

One engine bot's move function: the value type in
[GameRules.botActions](#botactions).

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TAction` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |
| `TObservation` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |
| `TConfig` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`BotActionArgs`](#botactionargs)\<`TObservation`, `TConfig`\> |

#### Returns

`TAction`

***

### GameAccess

```ts
type GameAccess = "public" | "private" | "friends";
```

Defined in: [eigen-server/packages/rules/src/contract.ts:31](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L31)

Game visibility.

***

### GamePayloadSchema

```ts
type GamePayloadSchema<Payload> = StandardSchemaV1<Payload, Payload> & StandardJSONSchemaV1<Payload, Payload>;
```

Defined in: [eigen-server/packages/rules/src/standard-json-schema.ts:8](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/standard-json-schema.ts#L8)

One game payload declaration: runtime validation plus portable schema
emission from the same transform-free object. Input and output deliberately
share one type: what parses is what persists and what Dart generates.

#### Type Parameters

| Type Parameter |
| ------ |
| `Payload` |

***

### GameResult

```ts
type GameResult = "win" | "loss" | "draw" | "eliminated";
```

Defined in: [eigen-server/packages/rules/src/contract.ts:28](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L28)

Per-player result of a finished game.

***

### Json

```ts
type Json = string | number | boolean | null | JsonArray | JsonObject;
```

Defined in: [eigen-server/packages/rules/src/json.ts:10](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/json.ts#L10)

Any JSON value. `undefined` is allowed inside objects (treated as an
absent key, matching how schema libraries model optional fields); it never
survives serialization.

***

### LifecycleAction

```ts
type LifecycleAction =
  | {
  type: "timeout";
}
  | {
  playerIndex: number;
  type: "forfeit" | "autoForfeit";
};
```

Defined in: [eigen-server/packages/rules/src/contract.ts:138](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L138)

The engine-constructed payload of a lifecycle action, recorded verbatim in
the action log (with `kind = 'lifecycle'`). Engine-owned and
version-independent: every game gets these transitions for free, without
declaring them in its schemas. `forfeit` carries the forfeiting seat (a
voluntary resign); `autoForfeit` is the engine-driven variant (account
purge); `timeout` carries no seat, and the affected seats are
[ApplyLifecycleArgs.pending](#pending-1).

***

### LifecycleType

```ts
type LifecycleType = "timeout" | "forfeit" | "autoForfeit";
```

Defined in: [eigen-server/packages/rules/src/contract.ts:25](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L25)

The trigger of a lifecycle action, resolved by the game's `applyLifecycle`
hook. `forfeit` is a voluntary resign; `autoForfeit` the engine-driven
variant (account-deletion purge); `timeout` is the clock. The two forfeits
share a shape (both target `data.playerIndex`) and most games resolve them
identically, but the hook receives the real trigger, so a game may choose
different consequences (e.g. a draw rather than a loss when the seat was
purged).

***

### OutcomeEntry

```ts
type OutcomeEntry = {
  placement: number;
  playerIndex: number;
  result: GameResult;
  score?: number | null;
  teamIndex: number;
};
```

Defined in: [eigen-server/packages/rules/src/contract.ts:68](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L68)

One participant's result, recorded when the game ends. `placement`
(1 = best, ties share a value) feeds OpenSkill directly; `teamIndex`
groups players rated together (use `playerIndex` for individual games).

A `type` alias, not an `interface`, on purpose: outcomes are JSON payloads
(persisted, compared by fixture runners), and only a type alias gets the
implicit index signature that makes it assignable to `Json`.

#### Properties

##### placement

```ts
placement: number;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:71](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L71)

##### playerIndex

```ts
playerIndex: number;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:69](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L69)

##### result

```ts
result: GameResult;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:70](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L70)

##### score?

```ts
optional score?: number | null;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:74](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L74)

Optional raw game score, for display or score-based variants.

##### teamIndex

```ts
teamIndex: number;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:72](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L72)

***

### TransitionCause

```ts
type TransitionCause<TAction> =
  | {
  data: TAction;
  kind: "game";
  playerIndex: number;
}
  | {
  data: LifecycleAction;
  kind: "lifecycle";
}
  | null;
```

Defined in: [eigen-server/packages/rules/src/contract.ts:168](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/contract.ts#L168)

The action that produced the state being projected: a `game` action
(`applyAction`), a `lifecycle` action (`applyLifecycle`), or `null` for
the initial frame (`initialState`), which no action produced.

This is how a game tells each seat *what happened*, since pure frame diffing
can't recover causality (identical footprints, hidden-info moves, composite
resolutions). Embed whatever animation/narration cues a seat is permitted
to see into that seat's slice `data` (e.g. a `lastMove` field); visibility
stays game-controlled because the embedding happens inside
`computeObservation`. Cues describe a *transition*: a client should render
them as animation only when it has the frame's predecessor, and as static
"last move" info otherwise.

#### Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `TAction` *extends* [`JsonObject`](#jsonobject) | [`JsonObject`](#jsonobject) |

## Functions

### passthroughObservation()

```ts
function passthroughObservation<TState, TAction, TConfig>(args): ObservationSlice<TState>;
```

Defined in: [eigen-server/packages/rules/src/helpers.ts:24](https://github.com/eigeninteractive/eigen-server/blob/df5d21daba299f75c8179711bbcd38a29dabfd08/packages/rules/src/helpers.ts#L24)

Default `computeObservation` for perfect-information games: every seat sees
the full state and the true pending set. Ignores `args.cause`, since a
perfect-info client can usually infer the transition from consecutive
frames; embed explicit cues in the slice instead when it can't. Note that
under the same-view rule a passthrough game is automatically strict about
simultaneous submissions: any opponent move changes every seat's view.

#### Type Parameters

| Type Parameter |
| ------ |
| `TState` *extends* [`JsonObject`](#jsonobject) |
| `TAction` *extends* [`JsonObject`](#jsonobject) |
| `TConfig` *extends* [`JsonObject`](#jsonobject) |

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `args` | [`ComputeObservationArgs`](#computeobservationargs)\<`TState`, `TAction`, `TConfig`\> |

#### Returns

[`ObservationSlice`](#observationslice)\<`TState`\>
