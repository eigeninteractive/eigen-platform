import { canonicalRequest, userPrincipal } from "../src/command-request.js";
import type { CreateReservation } from "../src/d1/apply.js";
import type { users } from "../src/d1/schema.js";

type UserRow = typeof users.$inferInsert;

/**
 * A complete `users` row with sensible defaults; override only what a test
 * actually cares about (usually just the display name). Centralises the
 * eight-field shape that every spec was building inline, so a new NOT NULL
 * column is one edit here instead of a hunt across the seed blocks.
 */
export function userRow(id: string, overrides: Partial<UserRow> = {}): UserRow {
  const now = Date.now();
  return { id, username: id, email: null, displayName: id, avatarUrl: null, isAnonymous: false, createdAt: now, updatedAt: now, ...overrides };
}

/**
 * A unique create reservation, for a spec that seeds a game through
 * `createGame` directly rather than over HTTP.
 *
 * Unique by default because a seed helper called twice must produce two games:
 * a shared id would make the second call a replay, which is the very thing the
 * reservation exists to cause. Pass `commandId` to deliberately collide.
 */
export function createReservationRow(userId = "user-a", commandId = crypto.randomUUID()): CreateReservation {
  const principal = userPrincipal(userId);
  return { principalId: principal, commandId, request: canonicalRequest({ principal, operation: "game.create", resource: "games", payload: { seed: commandId } }) };
}
