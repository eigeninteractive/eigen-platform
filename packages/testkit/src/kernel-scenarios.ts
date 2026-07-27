/**
 * The kernel-scenario surface for game tests — how an implementor drives real
 * engine transitions over their rules unit (same-view pairs, timing/grace
 * behavior, lifecycle outcomes) without depending on the engine's internals.
 *
 * `@eigeninteractive/kernel` is an internal package: implementors ship `@eigeninteractive/rules` +
 * `@eigeninteractive/server` and dev-depend on `@eigeninteractive/testkit` alone. Everything a
 * game's test suite legitimately needs from the kernel is re-exported here,
 * so the kernel's own surface stays free to churn.
 */

import { assertHookPayload, type SeatView } from "@eigeninteractive/kernel";
import type { GameRules, JsonObject, TransitionCause } from "@eigeninteractive/rules";

export type {
  CommitInput,
  CommitPlan,
  Effect,
  GameRow,
  Intent,
  ObservationFrame,
  RejectCode,
  Rejected,
  Seat,
  SeatView,
  StateRow,
} from "@eigeninteractive/kernel";
export {
  commit,
  DEADLINE_GRACE_MS,
  deriveRng,
  isRejected,
  randomSeed,
} from "@eigeninteractive/kernel";

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
  assertHookPayload(rules.schemas.observation, slice.data, `computeObservation for ${args.seat === null ? "viewer" : `seat ${args.seat}`}`);
  return { data: slice.data, pendingPlayers: slice.pendingPlayers };
}
