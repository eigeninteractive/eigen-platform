/**
 * Twin-drift fixture runner — the TS half of the shared JSON fixtures that
 * keep a version unit's TS and Dart `GameRules` twins in sync. Vitest/Node
 * port of the Supabase-era Deno runner; the JSON fixture format is unchanged,
 * so existing fixtures work as-is and the Dart runner
 * (`lib/testing/twin_fixtures.dart`) stays untouched.
 *
 * One fixture file per concern lives beside the version units at
 * `<fixturesRoot>/v<N>/*.json` and is consumed by BOTH sides: this module
 * runs each case against the TS unit (schemas + `applyAction` +
 * `computeObservation` + the two predicates), while the Dart runner runs the
 * same file against the Dart twin (`parseObservation`/`parseAction` codec,
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
 *         "pending": [1],            // optional, TS envelope.pending_players
 *         "outcome": [ ... ],        // optional, TS envelope.outcome
 *                                    //   (null asserts the game is ongoing)
 *         "observation": { ... }     // optional, the actor's post-action
 *                                    //   view: TS computeObservation slice
 *                                    //   data; Dart previewAction (when the
 *                                    //   game implements optimism)
 *       }
 *     },
 *     { "kind": "ratingPool",  "name": "...", "access": "public",
 *       "minPlayers": 2, "maxPlayers": 2, "config": {}, "expected": "blitz" },
 *     { "kind": "botSeatable", "name": "...", "gameConfig": {},
 *       "botConfig": {}, "expected": false }
 *   ]
 * }
 * ```
 *
 * The `state`/`obs` split exists for hidden-info games (a seat's observation
 * is not the state); perfect-info games omit `obs`. `expected.observation` is
 * the shared behavioral anchor: the TS side must project the post-action
 * state to it, and a Dart `previewAction` that returns non-null must predict
 * it — so the two sides are compared through one recorded value.
 *
 * Wire it up in a game-owned test file running under plain-Node vitest:
 *
 * ```ts
 * import { twinFixtureTests } from "@eigen/testkit";
 * import { gameModule } from "../src/rules/index.js";
 *
 * twinFixtureTests(gameModule, new URL("../src/rules/fixtures/", import.meta.url));
 * ```
 */

import { readdirSync, readFileSync } from "node:fs";
import { type Envelope, type GameAccess, type GameModule, type GameRules, IllegalMoveError, type Json, type JsonObject, type ObservationSlice, type OutcomeEntry } from "@eigen/rules";
import Rand from "rand-seed";
import { it } from "vitest";

/** One fixture file: cases targeting one `schema_version` unit. */
export interface TwinFixtureFile {
  schemaVersion: number;
  cases: TwinFixtureCase[];
}

/** A game-action case — exercises schemas, `applyAction`, and (through
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
  expected: {
    valid: boolean;
    state?: JsonObject;
    pending?: number[];
    outcome?: OutcomeEntry[] | null;
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

/** A `botSeatable` predicate case. */
export interface BotSeatableCase {
  kind: "botSeatable";
  name: string;
  gameConfig: JsonObject;
  botConfig: JsonObject;
  expected: boolean;
}

export type TwinFixtureCase = ActionCase | RatingPoolCase | BotSeatableCase;

// ── Fixture validation ────────────────────────────────────────────────────────
//
// The case types above are compile-time only; the JSON they describe arrives
// at runtime from a hand-written file. Asserting `JSON.parse(...) as
// TwinFixtureFile` would make every field a lie the moment a fixture is
// mistyped — and because most fields flow straight into a comparison, the
// symptom would be a confusing `undefined` diff attributed to the game's
// rules rather than to the fixture. These parsers close that gap: a
// malformed fixture fails at LOAD, naming the file, the case, and the field.
//
// Hand-written rather than schema-library-backed on purpose: `@eigen/rules`
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

/** Applies `read` only when the key is present and non-null; absent and
 * explicit null both mean "not specified" for every optional fixture field. */
function optional<T>(where: string, v: unknown, read: (where: string, v: unknown) => T): T | undefined {
  return v === undefined || v === null ? undefined : read(where, v);
}

function parseActionCase(where: string, raw: JsonObject): ActionCase {
  const expectedRaw = asObject(`${where}.expected`, raw.expected);
  const expected: ActionCase["expected"] = {
    valid: asBoolean(`${where}.expected.valid`, expectedRaw.valid),
    state: optional(`${where}.expected.state`, expectedRaw.state, asObject),
    pending: optional(`${where}.expected.pending`, expectedRaw.pending, asNumberArray),
    observation: optional(`${where}.expected.observation`, expectedRaw.observation, asObject),
  };
  // `outcome` is three-valued: absent (unchecked), null (asserts the game is
  // ongoing), or a list. `checkEnvelope` distinguishes absent from null with
  // an `in` test, so the key must only be set when the fixture set it.
  if ("outcome" in expectedRaw) {
    const outcome = expectedRaw.outcome;
    if (outcome !== null && !Array.isArray(outcome)) fail(`${where}.expected.outcome`, "an array or null", outcome);
    expected.outcome = outcome as OutcomeEntry[] | null;
  }
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

function parseBotSeatableCase(where: string, raw: JsonObject): BotSeatableCase {
  return {
    kind: "botSeatable",
    name: asString(`${where}.name`, raw.name),
    gameConfig: asObject(`${where}.gameConfig`, raw.gameConfig),
    botConfig: asObject(`${where}.botConfig`, raw.botConfig),
    expected: asBoolean(`${where}.expected`, raw.expected),
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
    // Prefer the case's own name in the location once we can read it — a
    // fixture author finds "cases[3] (seat 0 wins)" faster than an index.
    const indexed = `${path}.cases[${i}]`;
    const obj = asObject(indexed, raw);
    const where = typeof obj.name === "string" ? `${indexed} (${obj.name})` : indexed;
    switch (obj.kind) {
      case "action":
        return parseActionCase(where, obj);
      case "ratingPool":
        return parseRatingPoolCase(where, obj);
      case "botSeatable":
        return parseBotSeatableCase(where, obj);
      default:
        throw new Error(`${where}.kind: expected one of action | ratingPool | botSeatable, got ${JSON.stringify(obj.kind)}`);
    }
  });
  return { schemaVersion, cases };
}

/** Run one fixture case against a rules unit, returning failure descriptions
 * (empty ⇒ the case passes). Pure — the file-reading test registrar is
 * {@link twinFixtureTests}. */
export function evaluateTwinCase(rules: GameRules, kase: TwinFixtureCase): string[] {
  switch (kase.kind) {
    case "action":
      return evaluateAction(rules, kase);
    case "ratingPool":
      return evaluateRatingPool(rules, kase);
    case "botSeatable":
      return evaluateBotSeatable(rules, kase);
    default:
      return [`unknown case kind "${(kase as { kind: string }).kind}" — expected action | ratingPool | botSeatable`];
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
          throw new Error(`gameModule ships no rules unit for schema_version ${fixture.schemaVersion} (fixture: ${filePath})`);
        }
        const failures = evaluateTwinCase(rules, kase);
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
    failures.push(`action schema does not preserve the fixture action — parsed to ${JSON.stringify(action)}`);
  }

  const envelope = applyFixtureAction(rules, kase, config, state, action);
  if (typeof envelope === "string") {
    if (envelope) failures.push(envelope);
    return failures;
  }
  checkEnvelope(rules, kase, envelope, failures);
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
      rng: new Rand(kase.rngSeed ?? "twin-fixtures"),
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

function checkEnvelope(rules: GameRules, kase: ActionCase, envelope: Envelope, failures: string[]): void {
  if (validate(rules, "state", envelope.state) === undefined) {
    failures.push("applyAction returned state that violates its own schema");
  }
  const expected = kase.expected;
  if (expected.state !== undefined && !deepEquals(envelope.state, expected.state)) {
    failures.push(`envelope.state mismatch — got ${JSON.stringify(envelope.state)}`);
  }
  if (expected.pending !== undefined && !deepEquals(envelope.pending_players, expected.pending)) {
    failures.push(`envelope.pending_players mismatch — got ${JSON.stringify(envelope.pending_players)}`);
  }
  if ("outcome" in expected && !deepEquals(envelope.outcome ?? null, expected.outcome ?? null)) {
    failures.push(`envelope.outcome mismatch — got ${JSON.stringify(envelope.outcome ?? null)}`);
  }
}

function checkObservation(rules: GameRules, kase: ActionCase, envelope: Envelope, config: JsonObject, action: JsonObject, failures: string[]): void {
  let slice: ObservationSlice;
  try {
    slice = rules.computeObservation({
      state: envelope.state,
      pending: envelope.pending_players,
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
    failures.push(`actor's observation mismatch — got ${JSON.stringify(slice.data)}`);
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Run one of the unit's Standard Schemas synchronously, returning the parsed
 * value or undefined on failure (issues written to the second return slot). */
function validate(rules: GameRules, which: "config" | "state" | "action", value: unknown, issues?: string[]): JsonObject | undefined {
  const result = rules.schemas[which]["~standard"].validate(value);
  if (result instanceof Promise) {
    issues?.push(`${which} schema validated asynchronously — must be sync`);
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
