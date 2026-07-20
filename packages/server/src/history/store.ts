/**
 * The game-history read seam (engine_stack.md §4.6, seam #2). Finished-game
 * replay fetches its projected transitions through this ~20-line interface, so
 * the source of history can change without touching the replay route.
 *
 * V1 ships exactly ONE implementation — {@link doHistoryStore}, the game's own
 * DO range-fetch — and no dispatch logic. The future cold-tier sweep adds an
 * R2-backed implementation and a DO-if-present-else-R2 composition behind this
 * same interface; the route never changes.
 *
 * Scoped to replay (finished games) on purpose: live gap recovery is always
 * the DO and stays a direct `stub.frames()` call. Both hit the same endpoint,
 * but only history has a pluggable backend.
 */

import type { FrameMessage, GameStub } from "../protocol.js";

export interface HistoryStore {
  /** Projected frames for a finished game's version range, for the caller's
   * seat (null = public-viewer projection). Raw state never leaves the DO —
   * the projection happens at the source. */
  replay(gameId: string, args: { seat: number | null; from: number; to: number }): Promise<FrameMessage[]>;
}

/** The v1 backend: the finished game's DO, range-fetched with `isReplay` set so
 * it re-projects (its live frame table was drained by the finish compaction). */
export function doHistoryStore(stub: (gameId: string) => GameStub): HistoryStore {
  return {
    replay: (gameId, args) => stub(gameId).frames({ ...args, isReplay: true }),
  };
}
