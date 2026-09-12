/**
 * Twin-drift fixture runner: the TS half of the shared JSON fixtures that
 * keep a version unit's TS and Dart `GameRules` twins in sync. The JSON
 * fixture format is shared verbatim with the Dart runner
 * (`lib/testing/twin_fixtures.dart`): one file, two consumers.
 *
 * One fixture file per concern lives beside the version units at
 * `<fixturesRoot>/v<N>/*.json` and is consumed by BOTH sides: this module
 * runs each case against the TS unit (schemas + the four hooks + the two
 * predicates, and whole matches through the real kernel), while the Dart
 * runner runs the same file against the Dart twin (generated payload parsing,
 * `isValidAction`, `previewAction`, predicate twins). A behavioral divergence
 * then fails one side's CI instead of degrading UX in production.
 *
 * ## Fixture file format
 *
 * ```jsonc
 * {
 *   "schemaVersion": 1,
 *   "cases": [
 *     {
 *       "kind": "action",
 *       "name": "seat 0 marks an empty cell",
 *       "config": {},
 *       "state": { ... },            // TS: applyAction input
 *       "obs": { ... },              // Dart-only; defaults to `state`
 *       "pending": [0],
 *       "playerIndex": 0,
 *       "participantCount": 2,       // optional, default 2
 *       "rngSeed": "any string",     // optional, default "twin-fixtures"
 *       "action": { ... },
 *       "expected": {
 *         "valid": true,             // false ⇒ TS IllegalMoveError,
 *                                    //         Dart isValidAction false
 *         "state": { ... },          // optional, TS envelope.state
 *         "pending": [1],            // optional, TS envelope.pendingPlayers
 *         "outcome": [ ... ],        // optional, TS envelope.outcome
 *                                    //   (null asserts the game is ongoing)
 *         "observation": { ... }     // optional, the actor's post-action
 *                                    //   view: TS computeObservation slice
 *                                    //   data; Dart previewAction (when the
 *                                    //   game implements optimism)
 *       }
 *     },
 *     { "kind": "playerLimits", "name": "...", "config": {},
 *       "expected": { "minPlayers": 2, "maxPlayers": 2 } },
 *     { "kind": "ratingPool",  "name": "...", "access": "public",
 *       "minPlayers": 2, "maxPlayers": 2, "config": {}, "expected": "blitz" },
 *     { "kind": "botSeatable", "name": "...", "gameConfig": {},
 *       "botConfig": {}, "expected": false },
 *     {
 *       "kind": "initialState",
 *       "name": "a fresh board seats both players",
 *       "config": { ... },
 *       "playerCount": 2,
 *       "rngSeed": "any string",     // optional, default "twin-fixtures"
 *       "expected": {                // the envelope block the action case
 *         "state": { ... },          //   records, minus `valid`
 *         "pending": [0, 1],
 *         "outcome": null
 *       }
 *     },
 *     {
 *       "kind": "lifecycle",
 *       "name": "a forfeit hands the match to the other seat",
 *       "config": { ... },
 *       "state": { ... },            // applyLifecycle input
 *       "pending": [0, 1],
 *       "type": "forfeit",           // timeout | forfeit | autoForfeit
 *       "playerIndex": 0,            // required for forfeit/autoForfeit,
 *                                    //   forbidden for timeout
 *       "participantCount": 2,       // optional, default 2
 *       "rngSeed": "any string",     // optional, default "twin-fixtures"
 *       "expected": { "state": { ... }, "pending": [], "outcome": [ ... ] }
 *     },
 *     {
 *       "kind": "transcript",
 *       "name": "a best-of-one match played to its finish",
 *       "config": { ... },
 *       "playerCount": 2,
 *       "seed": "the game's base rng seed",
 *       "transitions": [
 *         { "kind": "game", "playerIndex": 0, "data": { ... } },
 *         { "kind": "lifecycle", "type": "forfeit", "playerIndex": 1 }
 *       ],
 *       "expected": {
 *         "version": 3,              // the final committed state version
 *         "status": "finished",      // active | finished
 *         "state": { ... },          // optional, as above
 *         "pending": [],
 *         "outcome": [ ... ]
 *       }
 *     },
 *     {
 *       "kind": "rng",
 *       "name": "the stream initialState draws from",
 *       "seed": "twin-fixtures",
 *       "version": 0,
 *       "seat": 1,                   // optional; present ⇒ the bot stream
 *       "draws": [0.123, 0.456]      // 1..64 values, compared exactly
 *     }
 *   ]
 * }
 * ```
 *
 * The `state`/`obs` split exists for hidden-info games (a seat's observation
 * is not the state); perfect-info games omit `obs`. `expected.observation` is
 * the shared behavioral anchor: the TS side must project the post-action
 * state to it, and a Dart `previewAction` that returns non-null must predict
 * it, so the two sides are compared through one recorded value.
 *
 * ## What each kind records
 *
 * `action`, `playerLimits`, `ratingPool` and `botSeatable` pin one hook or
 * predicate. The four kinds below exist for offline play (architecture
 * decision 0012): a device runs the Dart twin through a Dart port of the
 * kernel, so the pieces the online client never had to reproduce — the
 * opening state, the lifecycle hooks, a whole match, and the random stream
 * itself — each need a recorded behavior of their own.
 *
 * - `initialState` runs `initialState` with `deriveRng(rngSeed, 0)`, the
 *   version-0 stream the engine's `start` commit derives, and checks the
 *   returned envelope exactly as the action case does.
 * - `lifecycle` runs `applyLifecycle` with the `data` payload the kernel
 *   builds (`{type:"timeout"}`, or `{type, playerIndex}`), then applies the
 *   kernel's forfeit guard: a forfeit must remove its own seat from pending.
 *   Like the action case, and unlike `initialState`, it draws from the raw
 *   `rngSeed` stream: a standalone hook case has no version to derive from.
 * - `transcript` replays an ordered match through the REAL kernel `commit()`,
 *   so every engine guard, the pending/version bookkeeping, and the
 *   per-transition `deriveRng(seed, version)` streams all participate. It is
 *   the case a Dart local kernel has to reproduce move for move, on the
 *   untimed table and with the human/bot roster {@link evaluateTranscript}
 *   documents.
 * - `rng` records raw `deriveRng` draws. Generated from the TypeScript kernel
 *   by {@link rngFixtureCase} / {@link writeRngFixture} and compared with
 *   `===`, no tolerance: the Dart port is required to be bit-identical, and a
 *   port that is merely close is a port that desynchronizes one draw later.
 *
 * Wire it up in a game-owned test file running under plain-Node vitest:
 *
 * ```ts
 * import { twinFixtureTests } from "@eigeninteractive/testkit";
 * import gameModule from "../src/module/index.js";
 *
 * twinFixtureTests(gameModule, new URL("../src/module/fixtures/", import.meta.url));
 * ```
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { assertForfeitPending, type CommitInput, type CommitPlan, commit, deriveRng, GameBugError, type GameRow, type Intent, isRejected, type Rejected, type Seat } from "@eigeninteractive/kernel";
import { type Envelope, type GameAccess, type GameModule, type GameRules, IllegalMoveError, type Json, type JsonObject, type LifecycleAction, type LifecycleType, type ObservationSlice, type OutcomeEntry, type Rng } from "@eigeninteractive/rules";
import Rand from "rand-seed";
import { it } from "vitest";

/** The stream a case draws from when it names no `rngSeed`. */
const DEFAULT_RNG_SEED = "twin-fixtures";

/** One fixture file: cases targeting one `schemaVersion` unit. */
export interface TwinFixtureFile {
  schemaVersion: number;
  cases: TwinFixtureCase[];
}

/** What a case may assert about the envelope a hook (or a whole transcript)
 * produced. Every field is optional: a fixture pins what it means to pin.
 * `outcome` is three-valued — absent leaves the outcome unchecked, `null`
 * asserts the game is ongoing, a list asserts it ended exactly so. */
export interface ExpectedEnvelope {
  state?: JsonObject;
  pending?: number[];
  outcome?: OutcomeEntry[] | null;
}

/** A game-action case: exercises schemas, `applyAction`, and (through
 * `expected.observation`) `computeObservation` for the acting seat. */
export interface ActionCase {
  kind: "action";
  name: string;
  config: JsonObject;
  state: JsonObject;
  /** Dart-side observation payload; unused here (defaults to `state`). */
  obs?: JsonObject;
  pending: number[];
  playerIndex: number;
  participantCount?: number;
  rngSeed?: string;
  action: JsonObject;
  expected: ExpectedEnvelope & {
    valid: boolean;
    observation?: JsonObject;
  };
}

/** A `ratingPool` predicate case. Omitted timing fields mean null. */
export interface RatingPoolCase {
  kind: "ratingPool";
  name: string;
  access: GameAccess;
  turnSeconds?: number | null;
  budgetSeconds?: number | null;
  incrementSeconds?: number | null;
  minPlayers: number;
  maxPlayers: number;
  config: JsonObject;
  expected: string | null;
}

/** A `playerLimits` case: the seats one config may be played with. */
export interface PlayerLimitsCase {
  kind: "playerLimits";
  name: string;
  config: JsonObject;
  expected: { minPlayers: number; maxPlayers: number };
}

/** A `botSeatable` predicate case. */
export interface BotSeatableCase {
  kind: "botSeatable";
  name: string;
  gameConfig: JsonObject;
  botConfig: JsonObject;
  expected: boolean;
}

/** The opening transition: what `initialState` returns for one config and
 * seat count, drawing from the version-0 stream a `start` commit derives. */
export interface InitialStateCase {
  kind: "initialState";
  name: string;
  config: JsonObject;
  playerCount: number;
  rngSeed?: string;
  expected: ExpectedEnvelope;
}

/** An `applyLifecycle` case: one engine-driven transition (a turn that ran
 * out, a resign, a purged account) resolved against a stated position. */
export interface LifecycleCase {
  kind: "lifecycle";
  name: string;
  config: JsonObject;
  state: JsonObject;
  pending: number[];
  type: LifecycleType;
  /** The forfeiting seat. Required for `forfeit`/`autoForfeit`; a `timeout`
   * carries no seat (its victims are `pending`), so it must be omitted. */
  playerIndex?: number;
  participantCount?: number;
  rngSeed?: string;
  expected: ExpectedEnvelope;
}

/** One transition of a {@link TranscriptCase}: a seat's move, or a resign. */
export type TranscriptTransition = { kind: "game"; playerIndex: number; data: JsonObject } | { kind: "lifecycle"; type: "forfeit"; playerIndex: number };

/** A whole match, replayed through the real kernel from a stated base seed.
 * The one case that pins the *engine's* bookkeeping — versions, pending
 * hand-off, the per-transition RNG streams — rather than a single hook. */
export interface TranscriptCase {
  kind: "transcript";
  name: string;
  config: JsonObject;
  playerCount: number;
  /** The game's base RNG seed: every transition's stream derives from it. */
  seed: string;
  transitions: TranscriptTransition[];
  expected: ExpectedEnvelope & {
    version: number;
    status: "active" | "finished";
  };
}

/** Recorded draws from one derived RNG stream. Generated by
 * {@link rngFixtureCase}, never hand-written: the values ARE the TypeScript
 * kernel's, and the Dart port has to reproduce them bit for bit. */
export interface RngCase {
  kind: "rng";
  name: string;
  seed: string;
  /** The state version the stream belongs to (`deriveRng`'s second arg). */
  version: number;
  /** Present ⇒ the bot stream for that seat, keyed `"<seed>:bot<seat>"`. */
  seat?: number;
  draws: number[];
}

export type TwinFixtureCase = ActionCase | PlayerLimitsCase | RatingPoolCase | BotSeatableCase | InitialStateCase | LifecycleCase | TranscriptCase | RngCase;

/** Every `kind` a fixture case may declare, in the order the error messages
 * and the evaluator switch list them. */
const CASE_KINDS = ["action", "playerLimits", "ratingPool", "botSeatable", "initialState", "lifecycle", "transcript", "rng"] as const;

// ── Fixture validation ────────────────────────────────────────────────────────
//
// The case types above are compile-time only; the JSON they describe arrives
// at runtime from a hand-written file. Asserting `JSON.parse(...) as
// TwinFixtureFile` would make every field a lie the moment a fixture is
// mistyped, and because most fields flow straight into a comparison, the
// symptom would be a confusing `undefined` diff attributed to the game's
// rules rather than to the fixture. These parsers close that gap: a
// malformed fixture fails at LOAD, naming the file, the case, and the field.
//
// Hand-written rather than schema-library-backed on purpose: `@eigeninteractive/rules`
// describes an implementor's schemas with `StandardSchemaV1` precisely so the
// engine never mandates a validation library, and the Dart twin runner is
// deliberately framework-free. This is ~80 lines and keeps both true.

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return typeof value;
}

function fail(where: string, expected: string, got: unknown): never {
  throw new Error(`${where}: expected ${expected}, got ${describe(got)}`);
}

function asObject(where: string, v: unknown): JsonObject {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(where, "an object", v);
  return v as JsonObject;
}

function asString(where: string, v: unknown): string {
  if (typeof v !== "string") fail(where, "a string", v);
  return v;
}

function asNumber(where: string, v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(where, "a finite number", v);
  return v;
}

function asBoolean(where: string, v: unknown): boolean {
  if (typeof v !== "boolean") fail(where, "a boolean", v);
  return v;
}

function asNumberArray(where: string, v: unknown): number[] {
  if (!Array.isArray(v)) fail(where, "an array of numbers", v);
  return v.map((n, i) => asNumber(`${where}[${i}]`, n));
}

/** A seat index, a seat count, or a state version: the fixture format has no
 * fractional or negative counts anywhere. */
function asIndex(where: string, v: unknown): number {
  const n = asNumber(where, v);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${where}: expected a non-negative integer, got ${JSON.stringify(v)}`);
  }
  return n;
}

/** Applies `read` only when the key is present and non-null; absent and
 * explicit null both mean "not specified" for every optional fixture field. */
function optional<T>(where: string, v: unknown, read: (where: string, v: unknown) => T): T | undefined {
  return v === undefined || v === null ? undefined : read(where, v);
}

/** The `expected` block every hook-running case shares. */
function parseExpectedEnvelope(where: string, raw: JsonObject): ExpectedEnvelope {
  const expected: ExpectedEnvelope = {
    state: optional(`${where}.state`, raw.state, asObject),
    pending: optional(`${where}.pending`, raw.pending, asNumberArray),
  };
  // `outcome` is three-valued: absent (unchecked), null (asserts the game is
  // ongoing), or a list. `checkEnvelope` distinguishes absent from null with
  // an `in` test, so the key must only be set when the fixture set it.
  if ("outcome" in raw) {
    const outcome = raw.outcome;
    if (outcome !== null && !Array.isArray(outcome)) fail(`${where}.outcome`, "an array or null", outcome);
    expected.outcome = outcome as OutcomeEntry[] | null;
  }
  return expected;
}

function parseActionCase(where: string, raw: JsonObject): ActionCase {
  const expectedRaw = asObject(`${where}.expected`, raw.expected);
  const expected: ActionCase["expected"] = {
    ...parseExpectedEnvelope(`${where}.expected`, expectedRaw),
    valid: asBoolean(`${where}.expected.valid`, expectedRaw.valid),
    observation: optional(`${where}.expected.observation`, expectedRaw.observation, asObject),
  };
  return {
    kind: "action",
    name: asString(`${where}.name`, raw.name),
    config: asObject(`${where}.config`, raw.config),
    state: asObject(`${where}.state`, raw.state),
    obs: optional(`${where}.obs`, raw.obs, asObject),
    pending: asNumberArray(`${where}.pending`, raw.pending),
    playerIndex: asNumber(`${where}.playerIndex`, raw.playerIndex),
    participantCount: optional(`${where}.participantCount`, raw.participantCount, asNumber),
    rngSeed: optional(`${where}.rngSeed`, raw.rngSeed, asString),
    action: asObject(`${where}.action`, raw.action),
    expected,
  };
}

function parseRatingPoolCase(where: string, raw: JsonObject): RatingPoolCase {
  const access = asString(`${where}.access`, raw.access);
  if (access !== "public" && access !== "private" && access !== "friends") {
    throw new Error(`${where}.access: expected one of public | private | friends, got ${JSON.stringify(access)}`);
  }
  return {
    kind: "ratingPool",
    name: asString(`${where}.name`, raw.name),
    access,
    turnSeconds: optional(`${where}.turnSeconds`, raw.turnSeconds, asNumber) ?? null,
    budgetSeconds: optional(`${where}.budgetSeconds`, raw.budgetSeconds, asNumber) ?? null,
    incrementSeconds: optional(`${where}.incrementSeconds`, raw.incrementSeconds, asNumber) ?? null,
    minPlayers: asNumber(`${where}.minPlayers`, raw.minPlayers),
    maxPlayers: asNumber(`${where}.maxPlayers`, raw.maxPlayers),
    config: asObject(`${where}.config`, raw.config),
    expected: raw.expected === null ? null : asString(`${where}.expected`, raw.expected),
  };
}

function parsePlayerLimitsCase(where: string, raw: JsonObject): PlayerLimitsCase {
  const expected = asObject(`${where}.expected`, raw.expected);
  return {
    kind: "playerLimits",
    name: asString(`${where}.name`, raw.name),
    config: asObject(`${where}.config`, raw.config),
    expected: {
      minPlayers: asNumber(`${where}.expected.minPlayers`, expected.minPlayers),
      maxPlayers: asNumber(`${where}.expected.maxPlayers`, expected.maxPlayers),
    },
  };
}

function parseBotSeatableCase(where: string, raw: JsonObject): BotSeatableCase {
  return {
    kind: "botSeatable",
    name: asString(`${where}.name`, raw.name),
    gameConfig: asObject(`${where}.gameConfig`, raw.gameConfig),
    botConfig: asObject(`${where}.botConfig`, raw.botConfig),
    expected: asBoolean(`${where}.expected`, raw.expected),
  };
}

function parseInitialStateCase(where: string, raw: JsonObject): InitialStateCase {
  return {
    kind: "initialState",
    name: asString(`${where}.name`, raw.name),
    config: asObject(`${where}.config`, raw.config),
    playerCount: asIndex(`${where}.playerCount`, raw.playerCount),
    rngSeed: optional(`${where}.rngSeed`, raw.rngSeed, asString),
    expected: parseExpectedEnvelope(`${where}.expected`, asObject(`${where}.expected`, raw.expected)),
  };
}

function parseLifecycleCase(where: string, raw: JsonObject): LifecycleCase {
  const type = asString(`${where}.type`, raw.type);
  if (type !== "timeout" && type !== "forfeit" && type !== "autoForfeit") {
    throw new Error(`${where}.type: expected one of timeout | forfeit | autoForfeit, got ${JSON.stringify(raw.type)}`);
  }
  // A timeout resolves whoever is pending and carries no seat, so a
  // `playerIndex` on one is not a harmless extra: it is a fixture author
  // expecting a seat the hook will never be told about.
  const playerIndex = optional(`${where}.playerIndex`, raw.playerIndex, asIndex);
  if (type === "timeout" && playerIndex !== undefined) {
    throw new Error(`${where}.playerIndex: a timeout carries no seat (its victims are "pending"); remove it`);
  }
  if (type !== "timeout" && playerIndex === undefined) {
    throw new Error(`${where}.playerIndex: a ${type} must name the forfeiting seat`);
  }
  return {
    kind: "lifecycle",
    name: asString(`${where}.name`, raw.name),
    config: asObject(`${where}.config`, raw.config),
    state: asObject(`${where}.state`, raw.state),
    pending: asNumberArray(`${where}.pending`, raw.pending),
    type,
    playerIndex,
    participantCount: optional(`${where}.participantCount`, raw.participantCount, asNumber),
    rngSeed: optional(`${where}.rngSeed`, raw.rngSeed, asString),
    expected: parseExpectedEnvelope(`${where}.expected`, asObject(`${where}.expected`, raw.expected)),
  };
}

function parseTranscriptTransition(where: string, raw: unknown): TranscriptTransition {
  const obj = asObject(where, raw);
  switch (obj.kind) {
    case "game":
      return {
        kind: "game",
        playerIndex: asIndex(`${where}.playerIndex`, obj.playerIndex),
        data: asObject(`${where}.data`, obj.data),
      };
    case "lifecycle": {
      // Only `forfeit` is transcriptable: a timeout needs an expired clock and
      // a local game is untimed, and `autoForfeit` is an account purge, which
      // no transcript of a played match can contain.
      const type = asString(`${where}.type`, obj.type);
      if (type !== "forfeit") {
        throw new Error(`${where}.type: expected forfeit, got ${JSON.stringify(obj.type)}`);
      }
      return {
        kind: "lifecycle",
        type,
        playerIndex: asIndex(`${where}.playerIndex`, obj.playerIndex),
      };
    }
    default:
      throw new Error(`${where}.kind: expected one of game | lifecycle, got ${JSON.stringify(obj.kind)}`);
  }
}

function parseTranscriptCase(where: string, raw: JsonObject): TranscriptCase {
  const expectedRaw = asObject(`${where}.expected`, raw.expected);
  const status = asString(`${where}.expected.status`, expectedRaw.status);
  if (status !== "active" && status !== "finished") {
    throw new Error(`${where}.expected.status: expected one of active | finished, got ${JSON.stringify(expectedRaw.status)}`);
  }
  if (!Array.isArray(raw.transitions)) fail(`${where}.transitions`, "an array", raw.transitions);
  return {
    kind: "transcript",
    name: asString(`${where}.name`, raw.name),
    config: asObject(`${where}.config`, raw.config),
    playerCount: asIndex(`${where}.playerCount`, raw.playerCount),
    seed: asString(`${where}.seed`, raw.seed),
    transitions: raw.transitions.map((transition, i) => parseTranscriptTransition(`${where}.transitions[${i}]`, transition)),
    expected: {
      ...parseExpectedEnvelope(`${where}.expected`, expectedRaw),
      version: asIndex(`${where}.expected.version`, expectedRaw.version),
      status,
    },
  };
}

/** The draw count one rng case may record. One is enough to catch a wrong
 * seeding; the cap keeps a fixture file a document rather than a data dump,
 * and a stream that agrees for 64 draws does not diverge at 65. */
const RNG_DRAW_LIMIT = 64;

function parseRngCase(where: string, raw: JsonObject): RngCase {
  if (!Array.isArray(raw.draws)) fail(`${where}.draws`, "an array of numbers", raw.draws);
  if (raw.draws.length === 0 || raw.draws.length > RNG_DRAW_LIMIT) {
    throw new Error(`${where}.draws: expected between 1 and ${RNG_DRAW_LIMIT} draws, got ${raw.draws.length}`);
  }
  return {
    kind: "rng",
    name: asString(`${where}.name`, raw.name),
    seed: asString(`${where}.seed`, raw.seed),
    version: asIndex(`${where}.version`, raw.version),
    seat: optional(`${where}.seat`, raw.seat, asIndex),
    draws: asNumberArray(`${where}.draws`, raw.draws),
  };
}

/** Validate one fixture file's parsed JSON, or throw naming the offending
 * file, case, and field. Exported so a repo can lint its fixtures without
 * running them. */
export function parseTwinFixtureFile(path: string, json: unknown): TwinFixtureFile {
  const root = asObject(path, json);
  const schemaVersion = asNumber(`${path}.schemaVersion`, root.schemaVersion);
  if (!Array.isArray(root.cases)) fail(`${path}.cases`, "an array", root.cases);
  const cases = root.cases.map((raw, i) => {
    // Prefer the case's own name in the location once we can read it: a
    // fixture author finds "cases[3] (seat 0 wins)" faster than an index.
    const indexed = `${path}.cases[${i}]`;
    const obj = asObject(indexed, raw);
    const where = typeof obj.name === "string" ? `${indexed} (${obj.name})` : indexed;
    switch (obj.kind) {
      case "action":
        return parseActionCase(where, obj);
      case "playerLimits":
        return parsePlayerLimitsCase(where, obj);
      case "ratingPool":
        return parseRatingPoolCase(where, obj);
      case "botSeatable":
        return parseBotSeatableCase(where, obj);
      case "initialState":
        return parseInitialStateCase(where, obj);
      case "lifecycle":
        return parseLifecycleCase(where, obj);
      case "transcript":
        return parseTranscriptCase(where, obj);
      case "rng":
        return parseRngCase(where, obj);
      default:
        throw new Error(`${where}.kind: expected one of ${CASE_KINDS.join(" | ")}, got ${JSON.stringify(obj.kind)}`);
    }
  });
  return { schemaVersion, cases };
}

/** Run one fixture case against a rules unit, returning failure descriptions
 * (empty ⇒ the case passes). Pure; the file-reading test registrar is
 * {@link twinFixtureTests}.
 *
 * `schemaVersion` is the version the case targets. It never selects
 * behavior — the caller already resolved `rules` from it — and only labels
 * the engine guard messages a `lifecycle` or `transcript` case can provoke;
 * {@link twinFixtureTests} passes the fixture file's. */
export function evaluateTwinCase(rules: GameRules, kase: TwinFixtureCase, schemaVersion = 1): string[] {
  switch (kase.kind) {
    case "action":
      return evaluateAction(rules, kase);
    case "playerLimits":
      return evaluatePlayerLimits(rules, kase);
    case "ratingPool":
      return evaluateRatingPool(rules, kase);
    case "botSeatable":
      return evaluateBotSeatable(rules, kase);
    case "initialState":
      return evaluateInitialState(rules, kase);
    case "lifecycle":
      return evaluateLifecycle(rules, kase, schemaVersion);
    case "transcript":
      return evaluateTranscript(rules, kase, schemaVersion);
    case "rng":
      return evaluateRng(kase);
    default:
      return [`unknown case kind "${(kase as { kind: string }).kind}", expected ${CASE_KINDS.join(" | ")}`];
  }
}

/** Register one vitest test per fixture case found under `fixturesRoot`
 * (layout: `<root>/v<N>/*.json`). Call at the top level of a test module
 * running in a Node environment. */
export function twinFixtureTests(gameModule: GameModule, fixturesRoot: string | URL): void {
  for (const filePath of fixtureFiles(fixturesRoot)) {
    const fixture = parseTwinFixtureFile(filePath, JSON.parse(readFileSync(filePath, "utf8")));
    const rules = gameModule.versions[fixture.schemaVersion];
    for (const kase of fixture.cases) {
      it(`twin v${fixture.schemaVersion}: ${kase.name}`, () => {
        if (!rules) {
          throw new Error(`gameModule ships no rules unit for schemaVersion ${fixture.schemaVersion} (fixture: ${filePath})`);
        }
        const failures = evaluateTwinCase(rules, kase, fixture.schemaVersion);
        if (failures.length) throw new Error(`\n${failures.join("\n")}`);
      });
    }
  }
}

function* fixtureFiles(root: string | URL): Generator<string> {
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const dir of dirs) {
    const files = readdirSync(`${dir.parentPath}/${dir.name}`, {
      withFileTypes: true,
    })
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const file of files) yield `${file.parentPath}/${file.name}`;
  }
}

// ── Case evaluators ───────────────────────────────────────────────────────────

function evaluateAction(rules: GameRules, kase: ActionCase): string[] {
  const failures: string[] = [];
  const config = parseWith(rules, "config", kase.config, failures);
  const state = parseWith(rules, "state", kase.state, failures);
  const action = parseWith(rules, "action", kase.action, failures);
  if (config === undefined || state === undefined || action === undefined) {
    return failures;
  }

  // The parsed action must be the fixture action: a schema that strips or
  // defaults fields the twin relies on is itself drift.
  if (!deepEquals(action, kase.action)) {
    failures.push(`action schema does not preserve the fixture action, parsed to ${JSON.stringify(action)}`);
  }

  const envelope = applyFixtureAction(rules, kase, config, state, action);
  if (typeof envelope === "string") {
    if (envelope) failures.push(envelope);
    return failures;
  }
  checkEnvelope(rules, "applyAction", kase.expected, envelope, failures);
  if (kase.expected.observation !== undefined) {
    checkObservation(rules, kase, envelope, config, action, failures);
  }
  return failures;
}

/** Invoke `applyAction` and reconcile with `expected.valid`. Returns the
 * envelope on a valid accepted move, an error string on failure, or "" when
 * an expected-illegal move was correctly rejected (nothing left to check). */
function applyFixtureAction(rules: GameRules, kase: ActionCase, config: JsonObject, state: JsonObject, action: JsonObject): Envelope | string {
  let envelope: Envelope;
  try {
    envelope = rules.applyAction({
      state,
      pending: kase.pending,
      data: action,
      playerIndex: kase.playerIndex,
      rng: hookRng(kase.rngSeed),
      config,
    });
  } catch (error) {
    if (!(error instanceof IllegalMoveError)) {
      return `applyAction threw a non-IllegalMoveError: ${error}`;
    }
    return kase.expected.valid ? `applyAction rejected a move the fixture expects to be valid: ${error.message}` : "";
  }
  return kase.expected.valid ? envelope : "applyAction accepted a move the fixture expects to be illegal";
}

/** The stream a standalone hook case draws from. Seeded with the fixture's
 * `rngSeed` verbatim rather than through `deriveRng`, because a single hook
 * case stands outside any game: it has no committed version to derive a
 * stream from. The `initialState` case is the exception — a game's opening
 * transition is always version 0 — and a `transcript` case, which runs the
 * real kernel, gets the real per-version streams. */
function hookRng(rngSeed: string | undefined): Rng {
  return new Rand(rngSeed ?? DEFAULT_RNG_SEED);
}

/** Compare a hook's envelope with what a case recorded, and re-validate the
 * state it returned exactly as the engine does before committing it. */
function checkEnvelope(rules: GameRules, hook: string, expected: ExpectedEnvelope, envelope: Envelope, failures: string[]): void {
  if (validate(rules, "state", envelope.state) === undefined) {
    failures.push(`${hook} returned state that violates its own schema`);
  }
  if (expected.state !== undefined && !deepEquals(envelope.state, expected.state)) {
    failures.push(`envelope.state mismatch, got ${JSON.stringify(envelope.state)}`);
  }
  if (expected.pending !== undefined && !deepEquals(envelope.pendingPlayers, expected.pending)) {
    failures.push(`envelope.pendingPlayers mismatch, got ${JSON.stringify(envelope.pendingPlayers)}`);
  }
  if ("outcome" in expected && !deepEquals(envelope.outcome ?? null, expected.outcome ?? null)) {
    failures.push(`envelope.outcome mismatch, got ${JSON.stringify(envelope.outcome ?? null)}`);
  }
}

function checkObservation(rules: GameRules, kase: ActionCase, envelope: Envelope, config: JsonObject, action: JsonObject, failures: string[]): void {
  let slice: ObservationSlice;
  try {
    slice = rules.computeObservation({
      state: envelope.state,
      pending: envelope.pendingPlayers,
      playerIndex: kase.playerIndex,
      participantCount: kase.participantCount ?? 2,
      config,
      cause: { kind: "game", data: action, playerIndex: kase.playerIndex },
      isReplay: false,
    });
  } catch (error) {
    failures.push(`computeObservation threw: ${error}`);
    return;
  }
  if (!deepEquals(slice.data, kase.expected.observation as Json)) {
    failures.push(`actor's observation mismatch, got ${JSON.stringify(slice.data)}`);
  }
}

function evaluateRatingPool(rules: GameRules, kase: RatingPoolCase): string[] {
  const failures: string[] = [];
  const config = parseWith(rules, "config", kase.config, failures);
  if (config === undefined) return failures;
  const pool = rules.ratingPool({
    access: kase.access,
    turnSeconds: kase.turnSeconds ?? null,
    budgetSeconds: kase.budgetSeconds ?? null,
    incrementSeconds: kase.incrementSeconds ?? null,
    minPlayers: kase.minPlayers,
    maxPlayers: kase.maxPlayers,
    config,
  });
  if (pool !== kase.expected) {
    failures.push(`ratingPool returned ${JSON.stringify(pool)}, fixture expects ${JSON.stringify(kase.expected)}`);
  }
  return failures;
}

function evaluatePlayerLimits(rules: GameRules, kase: PlayerLimitsCase): string[] {
  const failures: string[] = [];
  const config = parseWith(rules, "config", kase.config, failures);
  if (config === undefined) return failures;
  const limits = rules.playerLimits({ config });
  if (limits.minPlayers !== kase.expected.minPlayers || limits.maxPlayers !== kase.expected.maxPlayers) {
    failures.push(`playerLimits returned ${limits.minPlayers}-${limits.maxPlayers}, fixture expects ${kase.expected.minPlayers}-${kase.expected.maxPlayers}`);
  }
  return failures;
}

function evaluateBotSeatable(rules: GameRules, kase: BotSeatableCase): string[] {
  const failures: string[] = [];
  const gameConfig = parseWith(rules, "config", kase.gameConfig, failures);
  if (gameConfig === undefined) return failures;
  const seatable = rules.botSeatable({
    gameConfig,
    botConfig: kase.botConfig,
  });
  if (seatable !== kase.expected) {
    failures.push(`botSeatable returned ${seatable}, fixture expects ${kase.expected}`);
  }
  return failures;
}

function evaluateInitialState(rules: GameRules, kase: InitialStateCase): string[] {
  const failures: string[] = [];
  const config = parseWith(rules, "config", kase.config, failures);
  if (config === undefined) return failures;
  let envelope: Envelope;
  try {
    envelope = rules.initialState({
      config,
      // Exactly what a `start` commit passes: the opening transition commits
      // as version 0, so its stream is the version-0 one.
      rng: deriveRng(kase.rngSeed ?? DEFAULT_RNG_SEED, 0),
      playerCount: kase.playerCount,
    });
  } catch (error) {
    failures.push(`initialState threw: ${error}`);
    return failures;
  }
  checkEnvelope(rules, "initialState", kase.expected, envelope, failures);
  return failures;
}

function evaluateLifecycle(rules: GameRules, kase: LifecycleCase, schemaVersion: number): string[] {
  const failures: string[] = [];
  const config = parseWith(rules, "config", kase.config, failures);
  const state = parseWith(rules, "state", kase.state, failures);
  if (config === undefined || state === undefined) return failures;

  // Built exactly as `commit()` builds it, because the payload is the hook's
  // only word on which seat is leaving: a `timeout` names none and resolves
  // the whole pending set, and the parser already refused any other pairing.
  const data: LifecycleAction = kase.type === "timeout" ? { type: "timeout" } : { type: kase.type, playerIndex: kase.playerIndex as number };

  let envelope: Envelope;
  try {
    envelope = rules.applyLifecycle({
      state,
      pending: kase.pending,
      type: kase.type,
      data,
      rng: hookRng(kase.rngSeed),
      config,
    });
  } catch (error) {
    failures.push(`applyLifecycle threw: ${error}`);
    return failures;
  }
  checkEnvelope(rules, "applyLifecycle", kase.expected, envelope, failures);
  if (data.type !== "timeout") {
    // The engine's own guard, run here rather than restated: a forfeit that
    // leaves its seat pending is a game bug the kernel would refuse to commit,
    // and a fixture recording one would record an unreachable behavior for the
    // Dart twin to reproduce.
    try {
      assertForfeitPending(data.playerIndex, envelope, schemaVersion);
    } catch (error) {
      failures.push(`${error instanceof Error ? error.message : error}`);
    }
  }
  return failures;
}

/**
 * Replay an ordered match through the real kernel.
 *
 * The table is the one a local (offline) game plays on, and the conventions
 * below are a contract with the Dart local kernel that replays the same file:
 *
 * - untimed and unrated (`turnSeconds`, `budgetSeconds`, `incrementSeconds`
 *   all null), so no deadline is ever armed and the clock is never read;
 * - a roster of `playerCount` identified seats: seat 0 is the human
 *   `user-0`, every other seat is the bot `bot-<seat>`;
 * - the match opens with a `start` intent carrying the case's `seed`, so
 *   every transition draws from `deriveRng(seed, version)`;
 * - each transition commits at `expectedVersion` = the current version (a
 *   device is the only actor, so it is never stale), with `actor` `"user"`
 *   for seat 0 and `"bot"` for the rest.
 *
 * A rejection or a broken invariant fails the case naming the transition that
 * produced it: an engine that refuses the transcript is as much a divergence
 * as a wrong final state.
 */
function evaluateTranscript(rules: GameRules, kase: TranscriptCase, schemaVersion: number): string[] {
  const failures: string[] = [];
  // `commit()` parses the config itself; parsing here too reports a bad
  // fixture config as a fixture problem rather than as an engine throw.
  if (parseWith(rules, "config", kase.config, failures) === undefined) return failures;

  const game: GameRow = {
    status: "ready",
    schemaVersion,
    config: kase.config,
    turnSeconds: null,
    budgetSeconds: null,
    incrementSeconds: null,
    rated: false,
    ratingPool: null,
  };
  const roster: Seat[] = Array.from({ length: kase.playerCount }, (_, seat) => (seat === 0 ? { playerIndex: 0, userId: "user-0", botId: null, type: "human" } : { playerIndex: seat, userId: null, botId: `bot-${seat}`, type: "bot" }));

  let plan = runCommit({ game, state: null, roster, intent: { kind: "start", seed: kase.seed }, now: TRANSCRIPT_NOW, rules });
  if (typeof plan === "string") return [`start: ${plan}`];
  game.status = "active";

  for (const [index, transition] of kase.transitions.entries()) {
    const intent: Intent =
      transition.kind === "game"
        ? {
            kind: "action",
            seat: transition.playerIndex,
            expectedVersion: plan.nextState.version,
            data: transition.data,
            actor: transition.playerIndex === 0 ? "user" : "bot",
          }
        : { kind: "lifecycle", type: "forfeit", seat: transition.playerIndex };
    const result = runCommit({ game, state: plan.nextState, roster, intent, now: TRANSCRIPT_NOW, rules });
    if (typeof result === "string") return [`transitions[${index}] (${describeTransition(transition)}): ${result}`];
    plan = result;
    // A finished game refuses everything that follows, so a transcript with a
    // move after its last one fails on that move rather than silently here.
    if (plan.outcomes !== null) game.status = "finished";
  }

  const status = plan.outcomes === null ? "active" : "finished";
  if (plan.nextState.version !== kase.expected.version) {
    failures.push(`the match committed as version ${plan.nextState.version}, fixture expects ${kase.expected.version}`);
  }
  if (status !== kase.expected.status) {
    failures.push(`the match is ${status}, fixture expects ${kase.expected.status}`);
  }
  checkEnvelope(rules, "the final transition", kase.expected, { state: plan.nextState.state, pendingPlayers: plan.nextState.pending, ...(plan.outcomes === null ? {} : { outcome: plan.outcomes }) }, failures);
  return failures;
}

/** The commit instant every transcript transition carries. An untimed game
 * never reads it, and a fixed value keeps the case a pure function of the
 * transcript. */
const TRANSCRIPT_NOW = 0;

/** One kernel commit, with both failure species rendered as a string: a
 * rejection (a value) and a broken invariant (a throw) are equally a
 * transcript that does not replay. */
function runCommit(input: CommitInput): CommitPlan | string {
  let result: CommitPlan | Rejected;
  try {
    result = commit(input);
  } catch (error) {
    if (error instanceof GameBugError) return `the engine refused the hook result: ${error.message}`;
    return `commit threw: ${error}`;
  }
  if (isRejected(result)) return `the engine rejected the intent (${result.code}): ${result.message}`;
  return result;
}

function describeTransition(transition: TranscriptTransition): string {
  return transition.kind === "game" ? `seat ${transition.playerIndex} plays ${JSON.stringify(transition.data)}` : `seat ${transition.playerIndex} forfeits`;
}

function evaluateRng(kase: RngCase): string[] {
  const rng = rngStream(kase.seed, kase.version, kase.seat);
  const failures: string[] = [];
  for (const [index, expected] of kase.draws.entries()) {
    const draw = rng.next();
    // Exact equality, deliberately: a port that is merely close has already
    // diverged, and the next draw off a shared stream proves it loudly.
    if (draw !== expected) failures.push(`draw[${index}] is ${draw}, fixture records ${expected}`);
  }
  return failures;
}

/** The stream an {@link RngCase} describes: a transition's own stream, or,
 * when the case names a seat, the bot stream the Durable Object derives for
 * that seat before running its brain. */
function rngStream(seed: string, version: number, seat: number | undefined): Rng {
  return seat === undefined ? deriveRng(seed, version) : deriveRng(`${seed}:bot${seat}`, version);
}

// ── Generating rng fixtures ───────────────────────────────────────────────────
//
// An `rng` case is the one kind nobody writes by hand: its values are whatever
// the TypeScript kernel's generator produces, and the point of recording them
// is that the Dart port has to agree digit for digit. So the testkit generates
// them, and a game re-runs the generator when it wants more coverage.

/** What stream to record, and how much of it. */
export interface RngFixtureCaseOptions {
  /** The case name, used as the test name on both sides. */
  name: string;
  /** The game's base seed. */
  seed: string;
  /** The state version whose stream to record. */
  version: number;
  /** Record the bot stream for this seat instead of the transition's own. */
  seat?: number;
  /** How many draws to record (1 to 64). */
  count: number;
}

/** Record one derived stream from the real kernel as a fixture case. */
export function rngFixtureCase(options: RngFixtureCaseOptions): RngCase {
  const { name, seed, version, seat, count } = options;
  if (!Number.isInteger(count) || count < 1 || count > RNG_DRAW_LIMIT) {
    throw new Error(`rngFixtureCase(${JSON.stringify(name)}): count must be an integer between 1 and ${RNG_DRAW_LIMIT}, got ${count}`);
  }
  const rng = rngStream(seed, version, seat);
  return {
    kind: "rng",
    name,
    seed,
    version,
    ...(seat === undefined ? {} : { seat }),
    draws: Array.from({ length: count }, () => rng.next()),
  };
}

/**
 * Write a fixture file of generated `rng` cases.
 *
 * The `schemaVersion` is read from the `v<N>/` directory in `path`, the same
 * rule `eigen-contract` enforces over every fixture file, so the two can
 * never be written out of agreement. The document is validated before it is
 * written: a generator that emits something the runners would refuse to load
 * should fail at the generator.
 *
 * The output is plain two-space JSON. Only the values mean anything to either
 * runner, so a repo that formats JSON should run its formatter afterwards.
 *
 * ```ts
 * import { rngFixtureCase, writeRngFixture } from "@eigeninteractive/testkit";
 *
 * writeRngFixture("src/module/fixtures/v1/rng.json", [
 *   rngFixtureCase({ name: "version 0", seed: "twin-fixtures", version: 0, count: 16 }),
 *   rngFixtureCase({ name: "seat 1's bot stream", seed: "twin-fixtures", version: 3, seat: 1, count: 16 }),
 * ]);
 * ```
 */
export function writeRngFixture(path: string, cases: RngCase[]): void {
  const match = /(?:^|\/)v([1-9]\d*)\/[^/]+$/.exec(path.split("\\").join("/"));
  if (match === null) {
    throw new Error(`${path}: an rng fixture must be written into a v<N>/ directory, which names the schemaVersion it targets`);
  }
  const document = { schemaVersion: Number(match[1]), cases };
  parseTwinFixtureFile(path, document);
  writeFileSync(path, `${JSON.stringify(document, null, 2)}\n`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Run one of the unit's Standard Schemas synchronously, returning the parsed
 * value or undefined on failure (issues written to the second return slot). */
function validate(rules: GameRules, which: "config" | "state" | "action", value: unknown, issues?: string[]): JsonObject | undefined {
  const result = rules.schemas[which]["~standard"].validate(value);
  if (result instanceof Promise) {
    issues?.push(`${which} schema validated asynchronously; must be sync`);
    return undefined;
  }
  if (result.issues) {
    issues?.push(
      result.issues
        .map((i) => {
          const path = i.path?.map((p) => (typeof p === "object" ? String(p.key) : String(p))).join(".");
          return path ? `${path}: ${i.message}` : i.message;
        })
        .join("; "),
    );
    return undefined;
  }
  return result.value as JsonObject;
}

/** Parse a fixture payload through one of the unit's schemas, recording a
 * failure (and returning undefined) when it does not conform. */
function parseWith(rules: GameRules, which: "config" | "state" | "action", value: JsonObject, failures: string[]): JsonObject | undefined {
  const issues: string[] = [];
  const parsed = validate(rules, which, value, issues);
  if (parsed === undefined) {
    failures.push(`fixture ${which} fails the TS ${which} schema: ${issues.join("; ")}`);
  }
  return parsed;
}

/** Structural JSON equality. Object keys with `undefined` values count as
 * absent (matching how schema libraries model optional fields); array order
 * matters. */
export function deepEquals(a: Json | undefined, b: Json | undefined): boolean {
  if (a === undefined || a === null) return b === undefined || b === null;
  if (b === undefined || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, i) => deepEquals(item, b[i]));
  }
  if (typeof a === "object" || typeof b === "object") {
    if (typeof a !== "object" || typeof b !== "object") return false;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((k) => deepEquals((a as JsonObject)[k], (b as JsonObject)[k]));
  }
  return a === b;
}
