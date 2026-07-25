/**
 * The implementor contract — everything a game author must understand, and
 * nothing else. Ported near-verbatim from the Supabase-era
 * `_types/engine.types.ts`; the enums are now plain unions (no generated DB
 * types), schema slots are typed against Standard Schema (bring Zod, Valibot,
 * ArkType…), and the RNG is the engine-owned {@link Rng} interface.
 *
 * The Dart client has a same-named `GameRules` twin per version (payload
 * codec, `isValidAction`/`previewAction`, rendering, and the
 * `ratingPool`/`botSeatable` twins); shared JSON fixtures keep the two in
 * sync — see `@eigeninteractive/testkit`.
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { JsonObject } from "./json.js";

// ── Core enums ────────────────────────────────────────────────────────────────

/** The trigger of a lifecycle action, resolved by the game's `applyLifecycle`
 * hook. `forfeit` is a voluntary resign; `auto_forfeit` the engine-driven
 * variant (account-deletion purge); `timeout` is the clock. The two forfeits
 * share a shape (both target `data.player_index`) and most games resolve them
 * identically — but the hook receives the real trigger, so a game may choose
 * different consequences (e.g. a draw rather than a loss when the seat was
 * purged). */
export type LifecycleType = "timeout" | "forfeit" | "auto_forfeit";

/** Per-player result of a finished game. */
export type GameResult = "win" | "loss" | "draw" | "eliminated";

/** Game visibility. */
export type GameAccess = "public" | "private" | "friends";

/** Who performed a logged action. */
export type ActionType = "user" | "bot" | "system";

/** Which species a logged action is. Everything that transitions state is an
 * *action*; the two species differ by contract: a `game` action is
 * rules-scoped (game-defined payload, validated by `applyAction`, rejectable
 * as illegal), a `lifecycle` action is engine-scoped (a
 * {@link LifecycleAction} payload, resolved unconditionally by
 * `applyLifecycle`). Stamped on every logged transition, so replay classifies
 * the log structurally, never by payload shape. */
export type ActionKind = "game" | "lifecycle";

// ── RNG ───────────────────────────────────────────────────────────────────────

/** Deterministic per-transition random source, derived by the engine from the
 * game's stored base seed and the state version the envelope commits as. Draw
 * freely (`next()` → float in `[0, 1)`, stateful within the invocation);
 * replaying the transition re-derives the identical sequence, so the game
 * stays a pure function of (base seed, action log) — provided the hook draws
 * in deterministic code order. */
export interface Rng {
  next(): number;
}

// ── Game outcome / envelope / observation ─────────────────────────────────────

/**
 * One participant's result, recorded when the game ends. `placement`
 * (1 = best, ties share a value) feeds OpenSkill directly; `team_index`
 * groups players rated together (use `player_index` for individual games).
 *
 * A `type` alias, not an `interface`, on purpose: outcomes are JSON payloads
 * (persisted, compared by fixture runners), and only a type alias gets the
 * implicit index signature that makes it assignable to `Json`.
 */
export type OutcomeEntry = {
  player_index: number;
  result: GameResult;
  placement: number;
  team_index: number;
  /** Optional raw game score, for display or score-based variants. */
  score?: number | null;
};

/**
 * The result of advancing the game by one transition — the return of
 * `initialState`, `applyAction`, and `applyLifecycle`.
 */
export interface Envelope<TState extends JsonObject = JsonObject> {
  /** New pure game payload (board, deck, fog…). Never carries whose-turn or
   * winner info — those are engine-owned fields. Must match the game's
   * `schema_version` schema — the engine validates it before committing. */
  state: TState;
  /** 0-based seats that may act next. Empty ⇒ game over. */
  pending_players: number[];
  /** Present **only** when the game ends. Absent/undefined means ongoing. */
  outcome?: OutcomeEntry[];
  /** Optional per-action deadline override for *this action only* (does not
   * touch any player's bank). Omit to use the game's configured timing. */
  turn_seconds?: number;
}

/** One participant's view of the state, produced by `computeObservation`. */
export interface ObservationSlice {
  /** What this seat is permitted to see. */
  data: JsonObject;
  /** Pending set as this seat sees it — may be narrowed from the true set for
   * hidden-info games (e.g. a Nope window, or a simultaneous-commit round
   * where revealing that the opponent moved would leak information). It must
   * stay truthful about the seat *itself* — the engine enforces that. */
  pending_players: number[];
}

// ── Hook args ─────────────────────────────────────────────────────────────────

/** Args common to every hook: the game config, parsed by the engine against
 * the version schema of the {@link GameRules} entry being invoked. No
 * `schemaVersion` field — a rules unit is version-specific by construction,
 * so hooks never branch on version. */
interface HookContext<TConfig extends JsonObject = JsonObject> {
  config: TConfig;
}

export interface InitialStateArgs<TConfig extends JsonObject = JsonObject> extends HookContext<TConfig> {
  /** Deterministic RNG for this transition — see {@link Rng}. */
  rng: Rng;
  playerCount: number;
}

export interface ApplyActionArgs<TState extends JsonObject = JsonObject, TAction extends JsonObject = JsonObject, TConfig extends JsonObject = JsonObject> extends HookContext<TConfig> {
  state: TState;
  pending: number[];
  data: TAction;
  playerIndex: number;
  /** Deterministic per-transition RNG — see {@link Rng}. */
  rng: Rng;
}

/** The engine-constructed payload of a lifecycle action, recorded verbatim in
 * the action log (with `kind = 'lifecycle'`). Engine-owned and
 * version-independent: every game gets these transitions for free, without
 * declaring them in its schemas. `forfeit` carries the forfeiting seat (a
 * voluntary resign); `auto_forfeit` is the engine-driven variant (account
 * purge); `timeout` carries no seat — the affected seats are
 * {@link ApplyLifecycleArgs.pending}. */
export type LifecycleAction = { type: "timeout" } | { type: "forfeit" | "auto_forfeit"; player_index: number };

export interface ApplyLifecycleArgs<TState extends JsonObject = JsonObject, TConfig extends JsonObject = JsonObject> extends HookContext<TConfig> {
  state: TState;
  /** Seats awaiting an action. For `timeout` these are exactly the seats that
   * ran out of time — resolve the whole set in one envelope (you may declare a
   * draw). For `forfeit`/`auto_forfeit`, the target seat is in
   * `data.player_index`. */
  pending: number[];
  /** The trigger — always equal to `data.type`. */
  type: LifecycleType;
  data: LifecycleAction;
  /** Deterministic per-transition RNG — see {@link Rng}. */
  rng: Rng;
}

/**
 * The action that produced the state being projected — a `game` action
 * (`applyAction`), a `lifecycle` action (`applyLifecycle`), or `null` for
 * the initial frame (`initialState`), which no action produced.
 *
 * This is how a game tells each seat *what happened* — pure frame diffing
 * can't recover causality (identical footprints, hidden-info moves, composite
 * resolutions). Embed whatever animation/narration cues a seat is permitted
 * to see into that seat's slice `data` (e.g. a `lastMove` field); visibility
 * stays game-controlled because the embedding happens inside
 * `computeObservation`. Cues describe a *transition*: a client should render
 * them as animation only when it has the frame's predecessor, and as static
 * "last move" info otherwise.
 */
export type TransitionCause<TAction extends JsonObject = JsonObject> = { kind: "game"; data: TAction; playerIndex: number } | { kind: "lifecycle"; data: LifecycleAction } | null;

export interface ComputeObservationArgs<TState extends JsonObject = JsonObject, TAction extends JsonObject = JsonObject, TConfig extends JsonObject = JsonObject> extends HookContext<TConfig> {
  state: TState;
  pending: number[];
  /** The seat this projection is for, or `null` for a viewer (a non-participant
   * replaying a public game). A viewer projection only ever occurs with
   * `isReplay` true (a public finished game), so a game may safely reveal the
   * full post-game view for it. */
  playerIndex: number | null;
  participantCount: number;
  /** What produced `state` — see {@link TransitionCause}. Shared across the
   * per-seat fan-out; per-seat filtering of what it reveals is this hook's
   * job. */
  cause: TransitionCause<TAction>;
  /** TRUE only when projecting a finished game for replay — hidden-info games
   * may reveal opponent state. */
  isReplay: boolean;
}

/** The chosen game settings, passed to {@link GameRules.ratingPool} at
 * creation so the game can decide its rating pool (or that the game is
 * unrated). `config` is already parsed against the requested version's config
 * schema. */
export interface RatingPoolArgs<TConfig extends JsonObject = JsonObject> {
  access: GameAccess;
  turnSeconds: number | null;
  budgetSeconds: number | null;
  incrementSeconds: number | null;
  minPlayers: number;
  maxPlayers: number;
  config: TConfig;
}

/** A candidate bot seating, passed to {@link GameRules.botSeatable}.
 * `gameConfig` is parsed against the game's version schema; `botConfig` is the
 * bot's declared capabilities — game-owned but unversioned by the game
 * schemas, so it stays opaque. */
export interface BotSeatableArgs<TConfig extends JsonObject = JsonObject> {
  gameConfig: TConfig;
  botConfig: JsonObject;
}

/** A seated engine bot's turn to move, passed to the matching entry in
 * {@link GameRules.botActions}. The brain runs inside the game's Durable
 * Object post-commit and sees exactly what a human at this seat would
 * (`observation` — the same fog-of-war projection, so a bot cannot read hidden
 * state its seat may not); `botConfig` is that bot registry row's declared
 * knob (difficulty, personality). The engine self-applies the returned move as
 * this seat's action, validated against `schemas.action` exactly like a human
 * move. `rng` is deterministic per (game, version, seat) for reproducible
 * tests — but the chosen move is what gets logged, so the brain need not be
 * pure (replay uses the recorded action, never re-runs the brain). */
export interface BotActionArgs<TConfig extends JsonObject = JsonObject> extends HookContext<TConfig> {
  observation: ObservationSlice;
  botConfig: JsonObject;
  playerIndex: number;
  rng: Rng;
}

/** One engine bot's move function — the value type in
 * {@link GameRules.botActions}. */
export type BotAction<TAction extends JsonObject = JsonObject, TConfig extends JsonObject = JsonObject> = (args: BotActionArgs<TConfig>) => TAction;

// ── Schemas + rules unit ──────────────────────────────────────────────────────

/** The declarative payload contracts for one `schema_version`: the Standard
 * Schemas the engine uses to parse (and validate) every game payload crossing
 * the JSON boundary. Keep them transform-free — what parses is what persists,
 * and the engine re-validates hook-returned state against `state`. Schemas
 * must validate **synchronously** (every mainstream library does unless you
 * opt into async refinements) — the engine rejects an async schema as a game
 * bug. */
export interface GameSchemas<TState extends JsonObject = JsonObject, TAction extends JsonObject = JsonObject, TConfig extends JsonObject = JsonObject> {
  /** The pure game payload stored per transition. */
  state: StandardSchemaV1<unknown, TState>;
  /** A player move's `data`, as submitted by clients and bots. */
  action: StandardSchemaV1<unknown, TAction>;
  /** The per-instance creation config stored on the game. */
  config: StandardSchemaV1<unknown, TConfig>;
}

/**
 * Everything one `schema_version` of a game needs: the payload contracts plus
 * all six hooks, narrowly typed to that version's shapes.
 *
 * The type parameters are the version's payload types, inferred from the
 * schemas in {@link schemas} (`z.infer<typeof stateSchema>` etc. — use `type`
 * aliases, not `interface`s). The engine parses every payload with this
 * unit's schemas before invoking its hooks, so hook bodies never see
 * unvalidated JSON — and never another version's shape. When rules or shapes
 * change incompatibly, ship a new `GameRules` under the next version key
 * (reusing unchanged pieces by import) instead of branching inside hooks.
 */
export interface GameRules<TState extends JsonObject = JsonObject, TAction extends JsonObject = JsonObject, TConfig extends JsonObject = JsonObject> {
  /** The payload contracts for this version. */
  schemas: GameSchemas<TState, TAction, TConfig>;

  /** Starting envelope. Draw any setup randomness (deck shuffle, first
   * player…) from `args.rng`. */
  initialState(args: InitialStateArgs<TConfig>): Envelope<TState>;

  /** Apply a player's move. The engine has already confirmed it is this
   * seat's turn at the expected version, so do not re-check turn order — only
   * validate move legality and throw {@link IllegalMoveError} if it fails;
   * the engine renders it as the caller's error. Any other throw is a game
   * bug and surfaces as a server error. */
  applyAction(args: ApplyActionArgs<TState, TAction, TConfig>): Envelope<TState>;

  /** Resolve a lifecycle action (`forfeit`/`timeout`) into an envelope.
   * Lifecycle actions operate on the game from outside its rules — they may
   * be player-triggered (a resign) or engine-triggered (timeout, purge);
   * either way the consequence is the game's to decide. Unlike `applyAction`
   * it cannot be "illegal" — it always resolves. */
  applyLifecycle(args: ApplyLifecycleArgs<TState, TConfig>): Envelope<TState>;

  /** Project the state into one seat's view — including what that seat may
   * see of the transition that produced it (`args.cause`), so the client can
   * animate. Perfect-info games can use the `passthroughObservation` helper
   * (which ignores the cause). What this hook reveals also implicitly sets
   * the simultaneous-move policy: a stale submission survives exactly while
   * the acting seat's projected view is unchanged (the same-view rule). */
  computeObservation(args: ComputeObservationArgs<TState, TAction, TConfig>): ObservationSlice;

  /** Decide whether — and in which pool — a game with these settings is
   * rated. Return the pool name (e.g. `'rapid'`) or `null` for unrated. The
   * engine computes `canBeRated = pool != null && !guest` and validates the
   * client's concrete `rated` assertion against it (rejecting a mismatch).
   * The Dart `GameRules` keeps a twin of this so the create dialog can gate
   * the Rated/Casual toggle and send the same value. */
  ratingPool(args: RatingPoolArgs<TConfig>): string | null;

  /** Decide whether a bot's declared capabilities (`botConfig`) support a
   * game with `gameConfig`. The engine gates seating on this before
   * committing; the Dart `GameRules` twin filters the bot pickers locally.
   * Return `true` to allow. */
  botSeatable(args: BotSeatableArgs<TConfig>): boolean;

  /** Optional — the in-DO bot brains, **keyed by bot username**. When a
   * seated `engine`-type bot's turn starts, the engine resolves its registry
   * row's `username`, looks the move function up here, runs it post-commit,
   * and self-applies the returned move — so a bot game needs no external
   * service. Several bots that share behaviour point their usernames at the
   * same function and differ by their per-row `botConfig`; distinct behaviour
   * is a distinct entry. A seated engine bot whose username is absent here
   * (or an `external` bot with no `webhook_url`) is rejected at seating. The
   * returned move is validated against `schemas.action` and an illegal one is
   * rejected exactly like a human's, so a buggy brain fails that seat's turn
   * (the deadline backstops it) rather than corrupting the game. */
  botActions?: Record<string, BotAction<TAction, TConfig>>;
}

/**
 * A {@link GameRules} unit with its payload types erased — the type of a rules
 * entry once it is stored in a {@link GameModule.versions} registry that holds
 * *many* games'/versions' rules whose concrete `TState`/`TAction`/`TConfig`
 * genuinely differ. That container needs "a `GameRules` for *some* payload
 * types", an existential TypeScript cannot spell; `any` is the one sanctioned
 * escape for it (`unknown` cannot — the config/action params are contravariant
 * input positions). It is **safe** here because the engine re-validates every
 * payload against that entry's own `schemas` before invoking a hook, so the
 * static type was only ever an authoring aid — redundant once the unit is
 * registered. Authors keep full type-checking by writing
 * `class X implements GameRules<State, Action, Config>` (or annotating a
 * literal `: GameRules<…>`); assigning that into a `versions` map just works,
 * with no `as`-cast, because `any` disables the variance check at this seam.
 */
// biome-ignore lint/suspicious/noExplicitAny: type-erased plugin registry — see the doc comment above; `any` is the existential escape, guarded at runtime by per-entry schema validation.
export type AnyGameRules = GameRules<any, any, any>;

/**
 * The complete game-specific surface — the same-named twin of the Dart
 * `GameModule` (whose extras are client-only creation/about UI). Implement
 * this once per app and pass it to `createEngine`; the engine owns all
 * version dispatch — every request resolves the game's `schema_version`
 * entry from {@link versions} and invokes that unit's hooks. Game code never
 * branches on version.
 */
export interface GameModule {
  /** The {@link GameRules} units keyed by `schema_version` — exactly the
   * versions this build ships. Sparse on purpose: game creation rejects a
   * version not present here, loading a stored game requires its version's
   * entry, and a drained old version is retired by deleting its entry. The
   * value type is {@link AnyGameRules} — each entry is authored against its
   * concrete payload types and erased here; safe because the engine parses
   * each payload with the same entry's schemas before invoking its hooks. */
  versions: Record<number, AnyGameRules>;
}
