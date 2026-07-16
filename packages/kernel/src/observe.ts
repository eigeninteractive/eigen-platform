/**
 * Per-seat observation fan-out — the projection boundary. No raw state
 * escapes the kernel except through `computeObservation`.
 */

import type { ComputeObservationArgs, GameRules, JsonObject } from "@eigen/rules";
import { GameBugError } from "./errors.js";

/** One seat's projected frame, tagged with its seat. The host stamps
 * version/timing when it persists and fans these out. */
export interface ObservationFrame {
  player_index: number;
  data: JsonObject;
  pending_players: number[];
}

/** Project the new state into one slice per seat — the eager fan-out the host
 * persists per transition (frames serve live delivery and the same-view
 * compare, so they stay eager). `rules` is the game's own version unit,
 * already resolved by the caller. `args` is the hook's own contract minus the
 * per-seat `playerIndex`, which the loop supplies; the body still forwards
 * each field explicitly so a new hook arg forces a per-seat-or-shared
 * decision here. */
export function fanOutObservations(rules: GameRules, args: Omit<ComputeObservationArgs, "playerIndex">): ObservationFrame[] {
  const frames: ObservationFrame[] = [];
  for (let seat = 0; seat < args.participantCount; seat++) {
    const slice = rules.computeObservation({
      state: args.state,
      pending: args.pending,
      playerIndex: seat,
      participantCount: args.participantCount,
      config: args.config,
      cause: args.cause,
      isReplay: args.isReplay,
    });
    // A projection may mask OTHER seats' pending status (hidden info), but it
    // must be truthful about the seat itself: the frame is what gates that
    // seat's input and turn display, while the commit enforces the
    // authoritative set — a lie here soft-locks the client or produces taps
    // that always reject. Caught at the source, like assertHookState.
    if (slice.pending_players.includes(seat) !== args.pending.includes(seat)) {
      throw new GameBugError(`computeObservation for seat ${seat} misreports the seat's own pending status`);
    }
    frames.push({
      player_index: seat,
      data: slice.data,
      pending_players: slice.pending_players,
    });
  }
  return frames;
}
