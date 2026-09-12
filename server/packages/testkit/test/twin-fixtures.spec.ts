import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { deriveRng } from "@eigeninteractive/kernel";
import type { ApplyActionArgs, ApplyLifecycleArgs, ComputeObservationArgs, GameRules, InitialStateArgs, JsonObject, OutcomeEntry } from "@eigeninteractive/rules";
import { describe, expect, it } from "vitest";
import { evaluateTwinCase, parseTwinFixtureFile, rngFixtureCase, type TwinFixtureCase, writeRngFixture } from "../src/twin-fixtures.js";

/** A permissive Standard Schema: these tests are about the runner, not about
 * any validation library. One exception below carries a real predicate, so a
 * hook returning a state its own schema refuses still has a failure path. */
const schema = (ok: (value: unknown) => boolean = () => true) => ({
  "~standard": {
    version: 1 as const,
    vendor: "test",
    validate: (value: unknown) => (ok(value) ? { value } : { issues: [{ message: "refused by the schema" }] }),
    jsonSchema: { input: () => ({}), output: () => ({}) },
  },
});

const outcome = (winner: number): OutcomeEntry[] => [
  { playerIndex: winner, result: "win", placement: 1, teamIndex: winner },
  { playerIndex: 1 - winner, result: "loss", placement: 2, teamIndex: 1 - winner },
];

/**
 * A two-seat count-up game, deliberately minimal: seats alternate adding to a
 * counter until it reaches `config.target`. `initialState` draws once, so a
 * case can prove which stream it was handed, and `config.leakForfeit` makes
 * the lifecycle hook break the kernel's forfeit invariant on demand.
 */
const rules = {
  schemas: {
    state: schema((value) => (value as { count?: number }).count !== -1),
    observation: schema(),
    action: schema(),
    config: schema(),
  },
  initialState: ({ rng }: InitialStateArgs) => ({ state: { count: 0, roll: rng.next() }, pendingPlayers: [0] }),
  applyAction: ({ state, data, playerIndex, config }: ApplyActionArgs) => {
    const count = (state.count as number) + (data.amount as number);
    const over = count >= (config.target as number);
    return {
      state: { count, roll: state.roll },
      pendingPlayers: over ? [] : [1 - playerIndex],
      ...(over ? { outcome: outcome(playerIndex) } : {}),
    };
  },
  applyLifecycle: ({ state, pending, data, config }: ApplyLifecycleArgs) => {
    const loser = data.type === "timeout" ? (pending[0] ?? 0) : data.playerIndex;
    return {
      state,
      pendingPlayers: config.leakForfeit === true ? [loser] : [],
      outcome: outcome(1 - loser),
    };
  },
  computeObservation: ({ state, pending }: ComputeObservationArgs) => ({ data: state, pendingPlayers: pending }),
  playerLimits: () => ({ minPlayers: 2, maxPlayers: 2 }),
  timingOptions: () => [{ mode: "untimed" }],
  ratingPool: () => null,
  botSeatable: () => true,
} as unknown as GameRules;

/** Load one case through the real parser, so every test runs what a fixture
 * file would produce rather than a hand-built object the parser never saw. */
const load = (kase: JsonObject): TwinFixtureCase => {
  const file = parseTwinFixtureFile("fixture.json", { schemaVersion: 1, cases: [kase] });
  const first = file.cases[0];
  if (first === undefined) throw new Error("no case parsed");
  return first;
};

const evaluate = (kase: JsonObject): string[] => evaluateTwinCase(rules, load(kase), 1);

describe("fixture validation", () => {
  it("names every kind it accepts", () => {
    expect(() => load({ kind: "transcripts", name: "typo" })).toThrow(/expected one of action \| playerLimits \| ratingPool \| botSeatable \| initialState \| lifecycle \| transcript \| rng/);
  });

  it("refuses a timeout that names a seat", () => {
    expect(() =>
      load({
        kind: "lifecycle",
        name: "timeout",
        config: {},
        state: { count: 1 },
        pending: [0],
        type: "timeout",
        playerIndex: 0,
        expected: {},
      }),
    ).toThrow(/a timeout carries no seat/);
  });

  it("requires a forfeit to name its seat", () => {
    expect(() =>
      load({
        kind: "lifecycle",
        name: "forfeit",
        config: {},
        state: { count: 1 },
        pending: [0],
        type: "forfeit",
        expected: {},
      }),
    ).toThrow(/must name the forfeiting seat/);
  });

  it("bounds the recorded draw count", () => {
    const rngCase = (draws: number[]) => ({ kind: "rng", name: "stream", seed: "s", version: 0, draws });

    expect(() => load(rngCase([]))).toThrow(/between 1 and 64 draws, got 0/);
    expect(() => load(rngCase(Array.from({ length: 65 }, () => 0.5)))).toThrow(/between 1 and 64 draws, got 65/);
  });

  it("accepts only a forfeit as a transcript lifecycle transition", () => {
    const transcript = (type: string) => ({
      kind: "transcript",
      name: "match",
      config: { target: 2 },
      playerCount: 2,
      seed: "seed",
      transitions: [{ kind: "lifecycle", type, playerIndex: 1 }],
      expected: { version: 1, status: "finished" },
    });

    expect(() => load(transcript("forfeit"))).not.toThrow();
    expect(() => load(transcript("autoForfeit"))).toThrow(/transitions\[0\]\.type: expected forfeit/);
  });

  it("refuses a negative seat", () => {
    expect(() => load({ kind: "rng", name: "stream", seed: "s", version: 0, seat: -1, draws: [0.5] })).toThrow(/seat: expected a non-negative integer, got -1/);
  });
});

describe("initialState cases", () => {
  const opening = (expected: JsonObject) => ({
    kind: "initialState",
    name: "opening",
    config: { target: 3 },
    playerCount: 2,
    rngSeed: "fixture-seed",
    expected,
  });

  it("hands the hook the version-0 stream a start commit derives", () => {
    const roll = deriveRng("fixture-seed", 0).next();

    expect(evaluate(opening({ state: { count: 0, roll }, pending: [0], outcome: null }))).toEqual([]);
  });

  it("reports a mismatched opening state", () => {
    expect(evaluate(opening({ state: { count: 1 }, pending: [0] }))).toEqual([expect.stringContaining("envelope.state mismatch")]);
  });

  it("reports an opening state its own schema refuses", () => {
    // `count: -1` is the one value the state schema above rejects, so this is
    // the engine's pre-commit validation failing, not a comparison.
    const failures = evaluateTwinCase({ ...rules, initialState: () => ({ state: { count: -1 }, pendingPlayers: [0] }) } as unknown as GameRules, load(opening({})), 1);

    expect(failures).toEqual(["initialState returned state that violates its own schema"]);
  });
});

describe("lifecycle cases", () => {
  const forfeit = (config: JsonObject) => ({
    kind: "lifecycle",
    name: "seat 1 resigns",
    config,
    state: { count: 2 },
    pending: [1],
    type: "forfeit",
    playerIndex: 1,
    expected: { state: { count: 2 }, pending: [], outcome: outcome(0) },
  });

  it("resolves a forfeit with the payload the kernel builds", () => {
    expect(evaluate(forfeit({ target: 5 }))).toEqual([]);
  });

  it("applies the kernel's forfeit guard", () => {
    const failures = evaluate({ ...forfeit({ target: 5, leakForfeit: true }), expected: { state: { count: 2 }, outcome: outcome(0) } });

    expect(failures).toEqual([expect.stringContaining("left the forfeited seat 1 in the pending set")]);
  });

  it("resolves a timeout over the whole pending set", () => {
    const failures = evaluate({
      kind: "lifecycle",
      name: "seat 0 runs out",
      config: { target: 5 },
      state: { count: 2 },
      pending: [0],
      type: "timeout",
      expected: { pending: [], outcome: outcome(1) },
    });

    expect(failures).toEqual([]);
  });
});

describe("transcript cases", () => {
  const match = (transitions: JsonObject[], expected: JsonObject) => ({
    kind: "transcript",
    name: "match",
    config: { target: 3 },
    playerCount: 2,
    seed: "match-seed",
    transitions,
    expected,
  });

  const add = (playerIndex: number, amount: number) => ({ kind: "game", playerIndex, data: { amount } });

  it("replays a match to its finish through the real kernel", () => {
    const failures = evaluate(
      match([add(0, 1), add(1, 1), add(0, 1)], {
        version: 3,
        status: "finished",
        pending: [],
        outcome: outcome(0),
      }),
    );

    expect(failures).toEqual([]);
  });

  it("replays a match that is still running", () => {
    expect(evaluate(match([add(0, 1)], { version: 1, status: "active", pending: [1], outcome: null }))).toEqual([]);
  });

  it("ends a match with a forfeit", () => {
    const failures = evaluate(
      match([add(0, 1), { kind: "lifecycle", type: "forfeit", playerIndex: 1 }], {
        version: 2,
        status: "finished",
        outcome: outcome(0),
      }),
    );

    expect(failures).toEqual([]);
  });

  it("names the transition the engine refused", () => {
    // Seat 0 moving twice in a row: the second is not its turn, and the case
    // must say which transition failed rather than which final state differed.
    const failures = evaluate(match([add(0, 1), add(0, 1)], { version: 2, status: "active" }));

    expect(failures).toEqual([expect.stringMatching(/^transitions\[1\] \(seat 0 plays \{"amount":1\}\): the engine rejected the intent \(notPending\)/)]);
  });

  it("refuses a transcript that moves after the game ended", () => {
    const failures = evaluate(match([add(0, 3), add(1, 1)], { version: 2, status: "finished" }));

    expect(failures).toEqual([expect.stringMatching(/^transitions\[1\].*notActive/)]);
  });

  it("reports a wrong final version and status", () => {
    const failures = evaluate(match([add(0, 1)], { version: 2, status: "finished" }));

    expect(failures).toEqual(["the match committed as version 1, fixture expects 2", "the match is active, fixture expects finished"]);
  });
});

describe("rng cases", () => {
  it("compares every draw exactly", () => {
    const recorded = rngFixtureCase({ name: "version 7", seed: "stream-seed", version: 7, count: 4 });

    expect(evaluateTwinCase(rules, recorded, 1)).toEqual([]);

    const nudged = { ...recorded, draws: [...recorded.draws] };
    nudged.draws[2] = (nudged.draws[2] as number) + Number.EPSILON;

    expect(evaluateTwinCase(rules, nudged, 1)).toEqual([expect.stringContaining("draw[2] is")]);
  });

  it("records the Durable Object's bot stream when the case names a seat", () => {
    const recorded = rngFixtureCase({ name: "seat 1", seed: "stream-seed", version: 7, seat: 1, count: 3 });
    const expectedRng = deriveRng("stream-seed:bot1", 7);

    expect(recorded.seat).toBe(1);
    expect(recorded.draws).toEqual([expectedRng.next(), expectedRng.next(), expectedRng.next()]);
  });

  it("refuses a count the fixture format could not hold", () => {
    expect(() => rngFixtureCase({ name: "too many", seed: "s", version: 0, count: 65 })).toThrow(/between 1 and 64/);
  });

  it("writes a loadable fixture whose version is its directory", () => {
    const root = mkdtempSync(resolve(tmpdir(), "eigen-rng-fixture-"));
    const path = resolve(root, "v3", "rng.json");
    const cases = [rngFixtureCase({ name: "version 0", seed: "s", version: 0, count: 2 })];

    expect(() => writeRngFixture(resolve(root, "rng.json"), cases)).toThrow(/must be written into a v<N>\/ directory/);

    mkdirSync(resolve(root, "v3"));
    writeRngFixture(path, cases);

    const written = parseTwinFixtureFile(path, JSON.parse(readFileSync(path, "utf8")));
    expect(written.schemaVersion).toBe(3);
    expect(written.cases).toEqual(cases);
  });
});
