/**
 * The test worker: a minimal sequential game ("race to the target") wired
 * through a BaseGameDO subclass, exercising the full DO surface (turn
 * alternation, timing, finish, ratings) with none of a real game's noise.
 */

import type { GameModule, GameRules, JsonObject } from "@eigeninteractive/rules";
import { BaseGameDO, createEngine } from "../src/index.js";
import { testFirebaseAdmin, testVerifier } from "../src/testing.js";

/** The worker-side Env: the global namespace declared in env.d.ts. */
export type TestEnv = Cloudflare.Env;

/** Hand-rolled Standard Schema: sync validate via a predicate. */
function schemaOf<T>(check: (value: unknown) => value is T) {
  return {
    "~standard": {
      version: 1 as const,
      vendor: "eigen-test",
      validate: (value: unknown) => (check(value) ? { value } : { issues: [{ message: "invalid payload" }] }),
      jsonSchema: {
        input: () => ({}),
        output: () => ({}),
      },
    },
  };
}

type State = { count: number };
type Action = { add: number };
type Config = { target: number };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const rules: GameRules = {
  schemas: {
    state: schemaOf((v): v is State => isObject(v) && typeof v.count === "number"),
    observation: schemaOf((v): v is State => isObject(v) && typeof v.count === "number"),
    action: schemaOf((v): v is Action => isObject(v) && (v.add === 1 || v.add === 2)),
    config: schemaOf((v): v is Config => isObject(v) && typeof v.target === "number"),
  },
  initialState: () => ({ state: { count: 0 }, pendingPlayers: [0] }),
  applyAction: ({ state, data, playerIndex, config }) => {
    const count = (state as State).count + (data as Action).add;
    const target = (config as Config).target;
    if (count >= target) {
      const other = 1 - playerIndex;
      return {
        state: { count },
        pendingPlayers: [],
        outcome: [
          { playerIndex: playerIndex, result: "win", placement: 1, teamIndex: playerIndex },
          { playerIndex: other, result: "loss", placement: 2, teamIndex: other },
        ],
      };
    }
    return { state: { count }, pendingPlayers: [1 - playerIndex] };
  },
  applyLifecycle: ({ state, pending, type, data }) => {
    const loser = type === "timeout" ? pending[0] : ((data as { playerIndex: number }).playerIndex as number);
    const winner = 1 - loser;
    return {
      state: state as JsonObject,
      pendingPlayers: [],
      outcome: [
        { playerIndex: winner, result: "win", placement: 1, teamIndex: winner },
        { playerIndex: loser, result: "loss", placement: 2, teamIndex: loser },
      ],
    };
  },
  // Full-reveal observation: every seat (and viewers) sees the raw state.
  computeObservation: ({ state, pending }) => ({ data: state as JsonObject, pendingPlayers: pending }),
  // A deliberately RANGED game (most real ones are fixed): the tests need both
  // a narrowing that is allowed and a range that is refused.
  playerLimits: () => ({ minPlayers: 2, maxPlayers: 4 }),
  timingOptions: () => [{ mode: "untimed" }, { mode: "perAction", minSeconds: 30, maxSeconds: 3600 }, { mode: "budget", minBudgetSeconds: 120, maxBudgetSeconds: 86400, minIncrementSeconds: 0, maxIncrementSeconds: 60 }],
  ratingPool: () => "test-pool",
  botSeatable: () => true,
  // In-DO brains, keyed by bot username: the `test-engine-bot` always
  // adds 1, so a human-vs-bot race advances two versions per human move.
  // Deterministic, so no rng needed.
  botActions: { "test-engine-bot": () => ({ add: 1 }) },
};

/** A second version with HIDDEN state (leak test): `secret` rides the raw
 * state through every transition but `computeObservation` never projects it,
 * not even in replay. `leak.spec.ts` asserts the sentinel escapes through no
 * response body or socket frame. */
export const LEAK_SENTINEL = "SUPER-SECRET-do-not-leak-42";
type HiddenState = { count: number; secret: string };

const hiddenRules: GameRules = {
  ...rules,
  schemas: {
    state: schemaOf((v): v is HiddenState => isObject(v) && typeof v.count === "number" && typeof v.secret === "string"),
    observation: schemaOf((v): v is JsonObject => isObject(v) && typeof v.count === "number"),
    action: schemaOf((v): v is Action => isObject(v) && (v.add === 1 || v.add === 2)),
    config: schemaOf((v): v is Config => isObject(v) && typeof v.target === "number"),
  },
  initialState: () => ({ state: { count: 0, secret: LEAK_SENTINEL }, pendingPlayers: [0] }),
  applyAction: ({ state, data, playerIndex, config }) => {
    const s = state as HiddenState;
    const count = s.count + (data as Action).add;
    if (count >= (config as Config).target) {
      const other = 1 - playerIndex;
      return {
        state: { count, secret: s.secret },
        pendingPlayers: [],
        outcome: [
          { playerIndex: playerIndex, result: "win", placement: 1, teamIndex: playerIndex },
          { playerIndex: other, result: "loss", placement: 2, teamIndex: other },
        ],
      };
    }
    return { state: { count, secret: s.secret }, pendingPlayers: [1 - playerIndex] };
  },
  applyLifecycle: ({ state, pending, type, data }) => {
    const loser = type === "timeout" ? pending[0] : (data as { playerIndex: number }).playerIndex;
    const winner = 1 - loser;
    return {
      state: state as JsonObject,
      pendingPlayers: [],
      outcome: [
        { playerIndex: winner, result: "win", placement: 1, teamIndex: winner },
        { playerIndex: loser, result: "loss", placement: 2, teamIndex: loser },
      ],
    };
  },
  // Hidden-info projection: only `count` is ever revealed; `secret` never is.
  computeObservation: ({ state, pending }) => ({ data: { count: (state as HiddenState).count }, pendingPlayers: pending }),
  playerLimits: () => ({ minPlayers: 2, maxPlayers: 4 }),
  timingOptions: () => [{ mode: "untimed" }, { mode: "perAction", minSeconds: 30, maxSeconds: 3600 }, { mode: "budget", minBudgetSeconds: 120, maxBudgetSeconds: 86400, minIncrementSeconds: 0, maxIncrementSeconds: 60 }],
  ratingPool: () => "test-pool",
  botSeatable: () => true,
};

const testGame: GameModule = { versions: { 1: hiddenRules } };

export class GameDO extends BaseGameDO<TestEnv> {
  protected readonly gameModule = testGame;
  protected d1(env: TestEnv): D1Database {
    return env.DB;
  }
  protected firebaseAdmin(_env: TestEnv) {
    return testFirebaseAdmin;
  }
}

/** The deployed shape, with the test auth seam: the same verifier
 * code path production uses, against the checked-in local JWKS. */
export default createEngine({
  gameModule: testGame,
  appName: "Eigen Test",
  d1: (env: TestEnv) => env.DB,
  gameDO: (env: TestEnv) => env.GAME_DO,
  testing: {
    auth: testVerifier(),
    firebaseAdmin: () => testFirebaseAdmin,
  },
  clientOrigins: ["https://app.example", "http://localhost:7357"],
  // deep linking + avatars, exercised by web.spec.ts. Avatars use
  // the simulated AVATARS bucket; publicBaseUrl is left unset (the worker-serve
  // default), so avatarUrl is the relative /avatars/{uid} route.
  deepLink: {
    android: { packageName: "com.eigen.test", sha256CertFingerprints: ["AA:BB:CC"], storeUrl: "https://play.google.com/store/apps/details?id=com.eigen.test" },
    apple: { appId: "TEAMID1234.com.eigen.test", storeUrl: "https://apps.apple.com/app/id000000000" },
  },
  avatars: { bucket: (env: TestEnv) => env.AVATARS, maxBytes: 4096 },
  // The public web surface, exercised by site.spec.ts. Legal documents are
  // left at the engine defaults so the tests assert the shipped prose and its
  // token substitution, not a fixture.
  site: {
    tagline: "Race an opponent to the target.",
    primaryColor: "#1a237e",
    // canonicalOrigin deliberately omitted: the suite exercises the inferred
    // origin (the single-custom-domain default), so absolute URLs read as the
    // request origin (`https://x`).
    screenshots: ["one.png", "two.png"],
    operator: { name: "Eigen Test & Co", jurisdiction: "Testland", contactEmail: "legal@test.example.com", effectiveDate: "1 January 2026" },
  },
});
