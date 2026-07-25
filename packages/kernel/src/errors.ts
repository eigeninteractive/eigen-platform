/**
 * The kernel's failure vocabulary. Two species, mirroring the old
 * EF's 400-vs-500 split without knowing anything about HTTP:
 *
 * - {@link Rejected} — an *expected* refusal of an intent (stale board,
 *   expired turn, illegal move…). Returned as a value from `commit()`; the
 *   host maps `code` to its transport (HTTP status, socket error frame).
 * - {@link GameBugError} — a broken invariant in the game's hooks or the
 *   stored data (state that violates its own schema, a forfeit that left its
 *   seat pending…). Thrown, because no caller can do anything with it except
 *   surface a server error and log.
 */

/** A broken game/engine invariant — a bug, not a rejection. */
export class GameBugError extends Error {}

/** Why an intent was refused. Stable machine codes — the host's transport
 * mapping and the client's retry policy key on these, so treat renames as
 * breaking. */
export type RejectCode =
  /** The game is not in a status that accepts this intent. */
  | "notActive"
  /** Start requested but the game is not ready. */
  | "notReady"
  /** The turn deadline (plus grace) had genuinely passed at arrival. */
  | "expired"
  /** The acting seat is not in the pending set. */
  | "notPending"
  /** Stale `expectedVersion` and the seat's view changed in between —
   * "state updated, try again". */
  | "stateUpdated"
  /** The action payload failed the version unit's action schema. */
  | "invalidPayload"
  /** The game's `applyAction` refused the move (IllegalMoveError). */
  | "illegalMove"
  /** A system intent (timeout) lost its race — already resolved, or not
   * actually expired. Not an error: the host treats it as a clean no-op. */
  | "abstain";

/** An intent the kernel refused. A value, not a throw — rejections are part
 * of the normal protocol. */
export interface Rejected {
  rejected: true;
  code: RejectCode;
  message: string;
}

export function reject(code: RejectCode, message: string): Rejected {
  return { rejected: true, code, message };
}
