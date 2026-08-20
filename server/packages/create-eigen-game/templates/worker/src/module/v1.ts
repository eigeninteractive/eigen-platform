import type { GameRules } from "@eigeninteractive/rules";
import { z } from "zod";

const stateSchema = z.object({ count: z.int().min(0) }).meta({ id: "ExampleGameV1State" });
const observationSchema = z.object({ count: z.int().min(0) }).meta({ id: "ExampleGameV1Observation" });
const actionSchema = z.object({ amount: z.int().min(1) }).meta({ id: "ExampleGameV1Action" });
const configSchema = z.object({ target: z.int().min(1) }).meta({ id: "ExampleGameV1Config" });

type State = z.infer<typeof stateSchema>;
type Observation = z.infer<typeof observationSchema>;
type Action = z.infer<typeof actionSchema>;
type Config = z.infer<typeof configSchema>;

const outcome = (winner: number) => [
  { playerIndex: winner, result: "win" as const, placement: 1, teamIndex: winner },
  { playerIndex: 1 - winner, result: "loss" as const, placement: 2, teamIndex: 1 - winner },
];

export const rulesV1: GameRules<State, Observation, Action, Config> = {
  schemas: {
    state: stateSchema,
    observation: observationSchema,
    action: actionSchema,
    config: configSchema,
  },

  initialState: () => ({
    state: { count: 0 },
    pendingPlayers: [0],
  }),

  applyAction: ({ state, data, playerIndex, config }) => {
    const count = state.count + data.amount;
    return {
      state: { count },
      pendingPlayers: count >= config.target ? [] : [1 - playerIndex],
      ...(count >= config.target ? { outcome: outcome(playerIndex) } : {}),
    };
  },

  applyLifecycle: ({ state, pending, data }) => {
    const loser = data.type === "timeout" ? (pending[0] ?? 0) : data.playerIndex;
    return {
      state,
      pendingPlayers: [],
      outcome: outcome(1 - loser),
    };
  },

  computeObservation: ({ state, pending }) => ({
    data: state,
    pendingPlayers: pending,
  }),

  // How many seats these rules can actually play. Two here, because
  // `applyAction` passes the turn with `1 - playerIndex`. The engine refuses a
  // create asking for a range outside this, so it is the one place a
  // fixed-size game says so. Read `config` if the count is a creation choice.
  playerLimits: () => ({ minPlayers: 2, maxPlayers: 2 }),
  timingOptions: () => [{ mode: "untimed" }],

  ratingPool: () => null,
  botSeatable: () => true,
};
