/**
 * The test worker: a minimal sequential game ("race to the target") wired
 * through a BaseGameDO subclass, exercising the full DO surface — turn
 * alternation, timing, finish, ratings — with none of a real game's noise.
 */

import type { GameModule, GameRules, JsonObject } from "@eigen/rules";
import { BaseGameDO, createEngine } from "../src/index.js";
import { testVerifier } from "../src/testing.js";

/** The worker-side Env — the global namespace declared in env.d.ts. */
export type TestEnv = Cloudflare.Env;

/** Hand-rolled Standard Schema: sync validate via a predicate. */
function schemaOf<T>(check: (value: unknown) => value is T) {
  return {
    "~standard": {
      version: 1 as const,
      vendor: "eigen-test",
      validate: (value: unknown) => (check(value) ? { value } : { issues: [{ message: "invalid payload" }] }),
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
    action: schemaOf((v): v is Action => isObject(v) && (v.add === 1 || v.add === 2)),
    config: schemaOf((v): v is Config => isObject(v) && typeof v.target === "number"),
  },
  initialState: () => ({ state: { count: 0 }, pending_players: [0] }),
  applyAction: ({ state, data, playerIndex, config }) => {
    const count = (state as State).count + (data as Action).add;
    const target = (config as Config).target;
    if (count >= target) {
      const other = 1 - playerIndex;
      return {
        state: { count },
        pending_players: [],
        outcome: [
          { player_index: playerIndex, result: "win", placement: 1, team_index: playerIndex },
          { player_index: other, result: "loss", placement: 2, team_index: other },
        ],
      };
    }
    return { state: { count }, pending_players: [1 - playerIndex] };
  },
  applyLifecycle: ({ state, pending, type, data }) => {
    const loser = type === "timeout" ? pending[0] : ((data as { player_index: number }).player_index as number);
    const winner = 1 - loser;
    return {
      state: state as JsonObject,
      pending_players: [],
      outcome: [
        { player_index: winner, result: "win", placement: 1, team_index: winner },
        { player_index: loser, result: "loss", placement: 2, team_index: loser },
      ],
    };
  },
  // Full-reveal observation: every seat (and viewers) sees the raw state.
  computeObservation: ({ state, pending }) => ({ data: state as JsonObject, pending_players: pending }),
  ratingPool: () => "test-pool",
  botSeatable: () => true,
  // In-DO brains (§7), keyed by bot username: the `test-engine-bot` always
  // adds 1, so a human-vs-bot race advances two versions per human move.
  // Deterministic — no rng needed.
  botActions: { "test-engine-bot": () => ({ add: 1 }) },
};

const testGame: GameModule = { versions: { 1: rules } };

export class GameDO extends BaseGameDO<TestEnv> {
  protected readonly gameModule = testGame;
  protected d1(env: TestEnv): D1Database {
    return env.DB;
  }
}

/** The deployed shape (§2.3), with the §6 test auth seam: the same verifier
 * code path production uses, against the checked-in local JWKS. */
export default createEngine({
  gameModule: testGame,
  d1: (env: TestEnv) => env.DB,
  gameDO: (env: TestEnv) => env.GAME_DO,
  auth: testVerifier(),
});
