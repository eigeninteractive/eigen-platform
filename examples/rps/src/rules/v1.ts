/**
 * Schema version 1 of Rock–Paper–Scissors — one self-contained
 * {@link GameRules} unit: the Zod payload contracts plus all six hooks, typed
 * to this version's shapes.
 *
 * RPS is the engine's hardest-case-first example: a simultaneous-commitment
 * hidden-information game. Both seats are pending each round; a committed
 * move is stored in the state but hidden from the opponent by
 * `computeObservation`, which also masks the *opponent's* pending status.
 * That masking is what makes the same-view rule work with zero game code: an
 * opponent's hidden commit doesn't change your projected view, so your
 * in-flight submission still lands — while the round *resolution* (reveal)
 * does change it, correctly invalidating anything computed against the
 * previous round.
 *
 * ## Payload typing — schema-first
 *
 * Declare a Zod schema per payload (`state`, `action`, `config`) and derive
 * the types with `z.infer`. The engine parses every payload with this unit's
 * schemas before invoking its hooks, so hook bodies receive validated, typed
 * values, and it re-validates the state a hook returns before committing.
 * Conventions: derive payload types as `type` aliases via `z.infer` (an
 * `interface` fails the engine's `JsonObject` constraint); keep schemas
 * transform-free — what parses is what persists.
 *
 * When rules or shapes change incompatibly, don't edit this file's semantics —
 * copy it to `v2.ts` (importing whatever didn't change from here), make the
 * change there, and register it in `index.ts`. Games created under v1 keep
 * running against this unit until they drain.
 */

import { type AnyGameRules, type ApplyActionArgs, type ApplyLifecycleArgs, type BotAction, type ComputeObservationArgs, type Envelope, type GameRules, IllegalMoveError, type InitialStateArgs, type ObservationSlice, type OutcomeEntry, type RatingPoolArgs } from "@eigen/rules";
import { z } from "zod";

const moveSchema = z.enum(["rock", "paper", "scissors"]);

const stateSchema = z.object({
  /** 1-based; increments when a resolved round leaves the match undecided. */
  round: z.int().min(1),
  /** Rounds won, per seat. */
  wins: z.tuple([z.int().min(0), z.int().min(0)]),
  /** The current round's hidden commits, per seat. */
  commits: z.tuple([moveSchema.nullable(), moveSchema.nullable()]),
  /** The last resolved round — the reveal the clients animate. */
  lastRound: z
    .object({
      moves: z.tuple([moveSchema, moveSchema]),
      /** Round winner's seat; null for a drawn round. */
      winner: z.union([z.literal(0), z.literal(1)]).nullable(),
    })
    .nullable(),
});

const actionSchema = z.object({ move: moveSchema });

const configSchema = z.object({
  /** First to this many round wins takes the match. */
  targetWins: z.int().min(1).max(10),
});

type Move = z.infer<typeof moveSchema>;
type State = z.infer<typeof stateSchema>;
type Action = z.infer<typeof actionSchema>;
type Config = z.infer<typeof configSchema>;

/** The seat `move` beats, or null when it doesn't decide against `other`. */
function beats(a: Move, b: Move): boolean {
  return (a === "rock" && b === "scissors") || (a === "scissors" && b === "paper") || (a === "paper" && b === "rock");
}

function matchOutcome(winner: 0 | 1): OutcomeEntry[] {
  const loser = winner === 0 ? 1 : 0;
  return [
    { player_index: winner, result: "win", placement: 1, team_index: winner },
    { player_index: loser, result: "loss", placement: 2, team_index: loser },
  ];
}

function drawOutcome(): OutcomeEntry[] {
  return [
    { player_index: 0, result: "draw", placement: 1, team_index: 0 },
    { player_index: 1, result: "draw", placement: 1, team_index: 1 },
  ];
}

class RpsRulesV1 implements GameRules<State, Action, Config> {
  readonly schemas = {
    state: stateSchema,
    action: actionSchema,
    config: configSchema,
  };

  initialState(_args: InitialStateArgs<Config>): Envelope<State> {
    return {
      state: { round: 1, wins: [0, 0], commits: [null, null], lastRound: null },
      pending_players: [0, 1],
    };
  }

  applyAction({ state, data, playerIndex, config }: ApplyActionArgs<State, Action, Config>): Envelope<State> {
    const seat = playerIndex as 0 | 1;
    // Unreachable through the engine (a committed seat is no longer pending);
    // kept as a defensive rules-level invariant.
    if (state.commits[seat] !== null) {
      throw new IllegalMoveError("You already committed this round");
    }
    const other = (1 - seat) as 0 | 1;
    const otherMove = state.commits[other];

    if (otherMove === null) {
      // First commit of the round: record it, wait for the opponent.
      const commits: State["commits"] = [null, null];
      commits[seat] = data.move;
      return {
        state: { ...state, commits },
        pending_players: [other],
      };
    }

    // Second commit: resolve the round.
    const moves: [Move, Move] = seat === 0 ? [data.move, otherMove] : [otherMove, data.move];
    const winner: 0 | 1 | null = beats(moves[0], moves[1]) ? 0 : beats(moves[1], moves[0]) ? 1 : null;
    const wins: State["wins"] = [...state.wins];
    if (winner !== null) wins[winner] += 1;
    const lastRound = { moves, winner };

    if (winner !== null && wins[winner] >= config.targetWins) {
      return {
        state: { ...state, wins, commits: [null, null], lastRound },
        pending_players: [],
        outcome: matchOutcome(winner),
      };
    }
    return {
      state: {
        round: state.round + 1,
        wins,
        commits: [null, null],
        lastRound,
      },
      pending_players: [0, 1],
    };
  }

  applyLifecycle({ state, pending, type, data }: ApplyLifecycleArgs<State, Config>): Envelope<State> {
    if (type === "timeout") {
      // Every pending seat failed to commit in time. Both idle ⇒ a drawn
      // match; one idle ⇒ the seat that did commit takes the match.
      if (pending.length === 2) {
        return { state, pending_players: [], outcome: drawOutcome() };
      }
      const winner = (1 - pending[0]) as 0 | 1;
      return { state, pending_players: [], outcome: matchOutcome(winner) };
    }
    const loser = (data as { player_index: number }).player_index as 0 | 1;
    return {
      state,
      pending_players: [],
      outcome: matchOutcome((1 - loser) as 0 | 1),
    };
  }

  computeObservation({ state, pending, playerIndex, isReplay }: ComputeObservationArgs<State, Action, Config>): ObservationSlice {
    if (isReplay || playerIndex === null) {
      // Post-game (participant replay or public viewer): reveal everything.
      return {
        data: {
          round: state.round,
          wins: state.wins,
          lastRound: state.lastRound,
          commits: state.commits,
        },
        pending_players: pending,
      };
    }
    const seat = playerIndex as 0 | 1;
    // Live projection — two deliberate omissions that ARE the game:
    //  - the opponent's commit is hidden (only your own comes back);
    //  - the opponent's pending status is masked (you see only your own),
    //    so their hidden commit never changes your view and the same-view
    //    rule lets simultaneous submissions land in either order.
    return {
      data: {
        round: state.round,
        wins: state.wins,
        lastRound: state.lastRound,
        yourMove: state.commits[seat],
      },
      pending_players: pending.filter((s) => s === seat),
    };
  }

  ratingPool({ access }: RatingPoolArgs<Config>): string | null {
    return access === "public" ? "standard" : null;
  }

  botSeatable(): boolean {
    return true;
  }

  /** The in-DO brains (§7), keyed by bot username. RPS ships one engine bot,
   * `rps-random`, which throws a uniformly random move: seat a registry row
   * with `type: 'engine'` and `username: 'rps-random'` and the DO runs this
   * post-commit whenever that bot is due. A second personality would be
   * another entry (e.g. `rps-counter`), or the same function reading a
   * `botConfig` difficulty knob. */
  readonly botActions: Record<string, BotAction<Action, Config>> = {
    "rps-random": ({ rng }) => {
      const moves: Move[] = ["rock", "paper", "scissors"];
      return { move: moves[Math.floor(rng.next() * moves.length)] };
    },
  };
}

/** The v1 rules unit, registered under key `1` in `index.ts`. The class is
 * authored against its concrete payload types (`implements GameRules<State,
 * Action, Config>` above — fully type-checked); annotating the export as
 * {@link AnyGameRules} erases those types for the registry with no cast, since
 * the engine re-validates every payload against `schemas` before a hook runs. */
export const rulesV1: AnyGameRules = new RpsRulesV1();
