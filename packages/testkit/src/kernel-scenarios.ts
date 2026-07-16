/**
 * The kernel-scenario surface for game tests — how an implementor drives real
 * engine transitions over their rules unit (same-view pairs, timing/grace
 * behavior, lifecycle outcomes) without depending on the engine's internals.
 *
 * `@eigen/kernel` is an internal package: implementors ship `@eigen/rules` +
 * `@eigen/server` and dev-depend on `@eigen/testkit` alone. Everything a
 * game's test suite legitimately needs from the kernel is re-exported here,
 * so the kernel's own surface stays free to churn.
 */

import type { SeatView } from "@eigen/kernel";
import type { GameRules, JsonObject, TransitionCause } from "@eigen/rules";

export type {
  CommitInput,
  CommitPlan,
  Effect,
  GameRow,
  Intent,
  ObservationFrame,
  RatingPrior,
  RejectCode,
  Rejected,
  Seat,
  SeatView,
  StateRow,
} from "@eigen/kernel";
export {
  commit,
  DEADLINE_GRACE_MS,
  deriveRng,
  isRejected,
  randomSeed,
} from "@eigen/kernel";

/** Project one seat's view of a state — the stored-frame shape the same-view
 * rule compares (`commit()`'s `staleViews` input). Convenience for scenario
 * tests that replay a simultaneous-move race. */
export function projectView(
  rules: GameRules,
  args: {
    state: JsonObject;
    pending: number[];
    /** The seat to project for, or null for a viewer. */
    seat: number | null;
    config: JsonObject;
    cause?: TransitionCause;
    participantCount?: number;
    isReplay?: boolean;
  },
): SeatView {
  const slice = rules.computeObservation({
    state: args.state,
    pending: args.pending,
    playerIndex: args.seat,
    participantCount: args.participantCount ?? 2,
    config: args.config,
    cause: args.cause ?? null,
    isReplay: args.isReplay ?? false,
  });
  return { data: slice.data, pending_players: slice.pending_players };
}
