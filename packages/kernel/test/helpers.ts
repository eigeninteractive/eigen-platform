/**
 * Test fixtures: a hand-rolled Standard Schema (no schema library — the
 * kernel only speaks the spec) and a tiny deterministic turn game exercising
 * every commit path: sequential turns, a per-action override, outcomes,
 * illegal moves.
 */

import type { Envelope, GameRules, JsonObject, OutcomeEntry } from "@eigeninteractive/rules";
import { IllegalMoveError, passthroughObservation } from "@eigeninteractive/rules";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { GameRow, Seat, StateRow } from "../src/commit.js";

/** A minimal synchronous Standard Schema from a predicate. */
export function schemaOf<T>(check: (value: unknown) => boolean): StandardSchemaV1<unknown, T> {
  return {
    "~standard": {
      version: 1,
      vendor: "eigen-test",
      validate: (value) => (check(value) ? { value: value as T } : { issues: [{ message: "failed test schema" }] }),
    },
  };
}

/** A Standard Schema whose validate returns a Promise — for the sync-only
 * enforcement test. */
export function asyncSchema<T>(): StandardSchemaV1<unknown, T> {
  return {
    "~standard": {
      version: 1,
      vendor: "eigen-test",
      validate: (value) => Promise.resolve({ value: value as T }),
    },
  };
}

export type TurnState = { count: number };
export type TurnAction = { add: number; boost?: boolean };
export type TurnConfig = { target: number };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * The test game: two seats alternate adding 1–3 to a counter; reaching
 * `config.target` wins. `boost: true` grants a 5-second per-action override.
 * Timeout: pending seats lose (all pending ⇒ draw). Forfeit: the target seat
 * loses. Perfect information (passthrough observation).
 */
export const turnRules: GameRules = {
  schemas: {
    state: schemaOf<TurnState>((v) => isObject(v) && typeof v.count === "number"),
    action: schemaOf<TurnAction>((v) => isObject(v) && typeof v.add === "number"),
    config: schemaOf<TurnConfig>((v) => isObject(v) && typeof v.target === "number"),
  },
  initialState: () => ({ state: { count: 0 }, pending_players: [0] }),
  applyAction: ({ state, data, playerIndex, pending }) => {
    const { add, boost } = data as TurnAction;
    if (add < 1 || add > 3) throw new IllegalMoveError("add must be 1-3");
    const count = (state as TurnState).count + add;
    const envelope: Envelope = {
      state: { count },
      pending_players: [(playerIndex + 1) % 2],
    };
    if (boost) envelope.turn_seconds = 5;
    if (count >= 10) {
      envelope.pending_players = [];
      envelope.outcome = winLoss(playerIndex, (playerIndex + 1) % 2);
    }
    void pending;
    return envelope;
  },
  applyLifecycle: ({ state, pending, type, data }) => {
    if (type === "timeout") {
      const outcome: OutcomeEntry[] =
        pending.length === 2
          ? [
              { player_index: 0, result: "draw", placement: 1, team_index: 0 },
              { player_index: 1, result: "draw", placement: 1, team_index: 1 },
            ]
          : winLoss((pending[0] + 1) % 2, pending[0]);
      return { state, pending_players: [], outcome };
    }
    const loser = (data as { player_index: number }).player_index;
    return {
      state,
      pending_players: [],
      outcome: winLoss((loser + 1) % 2, loser),
    };
  },
  computeObservation: passthroughObservation,
  ratingPool: () => "main",
  botSeatable: () => true,
};

function winLoss(winner: number, loser: number): OutcomeEntry[] {
  return [
    { player_index: winner, result: "win", placement: 1, team_index: winner },
    { player_index: loser, result: "loss", placement: 2, team_index: loser },
  ];
}

export const NOW = 1_800_000_000_000;

export function makeGame(overrides: Partial<GameRow> = {}): GameRow {
  return {
    status: "active",
    schemaVersion: 1,
    config: { target: 10 } as JsonObject,
    turnSeconds: null,
    budgetSeconds: null,
    incrementSeconds: null,
    rated: false,
    ratingPool: null,
    ...overrides,
  };
}

export function makeState(overrides: Partial<StateRow> = {}): StateRow {
  return {
    version: 4,
    state: { count: 4 },
    pending: [0],
    rngSeed: "test-seed",
    deadline: null,
    playerTimes: null,
    turnStartedAt: null,
    ...overrides,
  };
}

export function makeRoster(): Seat[] {
  return [
    { player_index: 0, user_id: "user-a", bot_id: null, type: "human" },
    { player_index: 1, user_id: "user-b", bot_id: null, type: "human" },
  ];
}
