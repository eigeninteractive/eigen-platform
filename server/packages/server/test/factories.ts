import { canonicalRequest, userPrincipal } from "../src/command-request.js";
import type { CreateReceipt } from "../src/d1/apply.js";
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
 * A unique create receipt, for a spec that seeds a game through `createGame`
 * directly rather than over HTTP.
 *
 * Unique by default because a seed helper called twice must produce two games: a
 * shared id would make the second call a replay, which is the very thing the
 * receipt exists to cause. Pass `commandId` to deliberately collide.
 */
export function createReceiptRow(userId = "user-a", commandId = crypto.randomUUID()): CreateReceipt {
  return { commandId, request: canonicalRequest({ principal: userPrincipal(userId), operation: "game.create", resource: "games", payload: { seed: commandId } }) };
}
