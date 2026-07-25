/**
 * The small runtime companions to the contract — the only two values (not
 * types) this package exports.
 */

import type { ComputeObservationArgs, ObservationSlice } from "./contract.js";
import type { JsonObject } from "./json.js";

/** Thrown by a game's `applyAction` to reject a move that breaks the rules —
 * the *expected* failure of the hook (a mis-tap, a client bug), rendered to
 * the caller as their error. Anything else a hook throws is treated as a game
 * bug and surfaces as a server error. Domain-level on purpose: the game
 * states "this move is illegal", the engine owns the transport mapping. */
export class IllegalMoveError extends Error {}

/**
 * Default `computeObservation` for perfect-information games: every seat sees
 * the full state and the true pending set. Ignores `args.cause` — a
 * perfect-info client can usually infer the transition from consecutive
 * frames; embed explicit cues in the slice instead when it can't. Note that
 * under the same-view rule a passthrough game is automatically strict about
 * simultaneous submissions: any opponent move changes every seat's view.
 */
export const passthroughObservation = <TState extends JsonObject, TAction extends JsonObject, TConfig extends JsonObject>(args: ComputeObservationArgs<TState, TAction, TConfig>): ObservationSlice => ({
  data: args.state,
  pendingPlayers: args.pending,
});
