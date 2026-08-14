/**
 * `@eigeninteractive/kernel`: the pure decision core. Given the current row, a state
 * snapshot and an intent, it returns a plan: the next state, the transition to
 * append, the observations to fan out, and any effects to schedule. It touches
 * no storage and no clock of its own, so every decision is reproducible from
 * its inputs alone.
 *
 * @module @eigeninteractive/kernel
 */

export {
  type CommitInput,
  type CommitPlan,
  commit,
  type Effect,
  type GameRow,
  type GameStatus,
  type Intent,
  isRejected,
  type Seat,
  type StateRow,
  type TransitionAction,
} from "./commit.js";
export { GameBugError, type RejectCode, type Rejected, reject } from "./errors.js";
export {
  assertBudgetPending,
  assertForfeitPending,
  assertHookState,
  assertPendingIdentified,
  canonicalJson,
  type SeatView,
  sameView,
} from "./guards.js";
export { fanOutObservations, type ObservationFrame } from "./observe.js";
export {
  computeRatings,
  defaultRating,
  displayRating,
  type PlayerInput,
  type Rating,
  type RatingDelta,
  type RatingResult,
} from "./ratings.js";
export { deriveRng, randomSeed } from "./rng.js";
export {
  assertHookPayload,
  type ParseResult,
  parseClientPayload,
  parseStoredPayload,
} from "./schema.js";
export {
  alarmForDeadline,
  computeNextDeadline,
  DEADLINE_GRACE_MS,
  deadlineExpired,
  deductBank,
  type NextDeadline,
} from "./timing.js";
