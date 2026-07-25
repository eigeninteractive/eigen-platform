/**
 * Deterministic randomness — the engine side of the {@link Rng} contract.
 */

import type { Rng } from "@eigeninteractive/rules";
import Rand from "rand-seed";

// The kernel loads no platform type libs (purity is enforced by the module
// graph), but `crypto` is a runtime global everywhere it runs (workerd, Node,
// browsers). Declare the one method used.
declare const crypto: {
  getRandomValues<T extends Uint8Array>(array: T): T;
};

/** A fresh base seed for a new game: 128 random bits, hex-encoded. Stored on
 * the game's v0 state row and copied onto every later row (server-only —
 * never expose it: the whole randomness of the game is derivable from it). */
export function randomSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The deterministic RNG for one transition: rand-seed's sfc32 keyed by the
 * game's base seed and the state version the envelope will commit as. The
 * same `(seed, version)` always yields the same draw sequence — a replay
 * re-derives it — and every transition gets an independent stream, so hooks
 * draw as many values as they need with no cross-invocation state. Identical
 * derivation to the Supabase-era engine, so recorded games stay replayable. */
export function deriveRng(seed: string, version: number): Rng {
  return new Rand(`${seed}:${version}`);
}
