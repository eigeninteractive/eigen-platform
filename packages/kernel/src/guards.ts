/**
 * Source-level invariant guards over hook envelopes (ports of the EF-era
 * `assert*` helpers — catch a game bug at the transition that creates it, not
 * on the next read), plus the same-view rule: the kernel's simultaneous-move
 * acceptance policy.
 */

import type { Envelope, GameSchemas, Json, JsonObject } from "@eigeninteractive/rules";
import { GameBugError } from "./errors.js";
import { parseStoredPayload } from "./schema.js";

/** Validate the state a hook returned against the game's version schema
 * before it is committed — catching a hook that wrote a malformed or
 * wrong-version shape at the source instead of on the next read.
 * Validate-only: the original envelope object is what gets persisted. */
export function assertHookState(schemas: GameSchemas, envelope: Envelope, schemaVersion: number): void {
  parseStoredPayload(schemas.state, envelope.state, "hook-returned state", schemaVersion);
}

/** Enforce budget mode's sequential-pending rule at the source: an
 * accumulated clock only meters individual thinking time when at most one
 * seat drains it, so a hook returning a multi-seat pending set in a
 * budget-timed game is a game bug. `computeNextDeadline`'s MIN-over-pending
 * remains the graceful-degradation safeguard should such a state ever be
 * reached. No-op when the game has no budget clock. */
export function assertBudgetPending(budgetSeconds: number | null, envelope: Envelope, schemaVersion: number): void {
  if (budgetSeconds !== null && envelope.pending_players.length > 1) {
    throw new GameBugError(`Hook returned ${envelope.pending_players.length} pending players in a budget-timed game (schema_version ${schemaVersion}); budget mode allows at most one pending seat`);
  }
}

/** Enforce that a forfeit actually removes the forfeited seat: a hook that
 * leaves `targetSeat` in the pending set is a game bug. Left uncaught, the
 * account-deletion purge would turn that seat into a ghost — no identity, yet
 * still holding a deadline the timeout alarm fires at forever. */
export function assertForfeitPending(targetSeat: number, envelope: Envelope, schemaVersion: number): void {
  if (envelope.pending_players.includes(targetSeat)) {
    throw new GameBugError(`Forfeit hook left the forfeited seat ${targetSeat} in the pending set (schema_version ${schemaVersion}); a forfeit must remove its target seat from pending`);
  }
}

/** Enforce that every pending seat has someone behind it: a seat whose
 * account was purged mid-game (both ids null) can never act, so a hook that
 * returns it as pending is a game bug — typically rules deriving pending from
 * the participant count instead of from who is still in the game. Backstop to
 * {@link assertForfeitPending}: that one catches the forfeit itself; this one
 * catches any later hook resurrecting the seat. */
export function assertPendingIdentified(
  roster: readonly {
    player_index: number;
    user_id: string | null;
    bot_id: string | null;
  }[],
  envelope: Envelope,
  schemaVersion: number,
): void {
  const identified = new Set(roster.filter((s) => s.user_id !== null || s.bot_id !== null).map((s) => s.player_index));
  const ghost = envelope.pending_players.find((seat) => !identified.has(seat));
  if (ghost !== undefined) {
    throw new GameBugError(`Hook returned pending seat ${ghost}, which has no identity (schema_version ${schemaVersion}); a purged seat can never act and must not be pending`);
  }
}

// ── Same-view rule ────────────────────────────────────────────────────────────

/** Canonical JSON: deterministic serialization with object keys sorted and
 * `undefined` object values treated as absent — so two structurally equal
 * views compare byte-identical regardless of construction order. */
export function canonicalJson(value: Json | undefined): string {
  if (value === undefined || value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** A seat's stored projection at one version — what the same-view compare
 * runs on (and what the DO persists per transition as `frames[]`). */
export interface SeatView {
  data: JsonObject;
  pending_players: number[];
}

/** The same-view rule: a stale-`expectedVersion` action is accepted
 * iff the acting seat's own projected observation — slice `data` plus the
 * seat's *observed* pending set — is identical between the expected and
 * current versions, ignoring version/timing bookkeeping. Identical view ⇒ the
 * intent transfers soundly (and `applyAction` still validates legality
 * against the true current state); changed view ⇒ the conflict is genuine and
 * "state updated" is literally true. The implementor controls this policy
 * implicitly through `computeObservation`: reveal an event and it invalidates
 * pending stale submissions; hide it and they survive. */
export function sameView(a: SeatView, b: SeatView): boolean {
  return canonicalJson(a.data) === canonicalJson(b.data) && canonicalJson(a.pending_players) === canonicalJson(b.pending_players);
}
