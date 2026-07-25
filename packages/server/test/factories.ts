import type { users } from "../src/d1/schema.js";

type UserRow = typeof users.$inferInsert;

/**
 * A complete `users` row with sensible defaults — override only what a test
 * actually cares about (usually just the display name). Centralises the
 * eight-field shape that every spec was building inline, so a new NOT NULL
 * column is one edit here instead of a hunt across the seed blocks.
 */
export function userRow(id: string, overrides: Partial<UserRow> = {}): UserRow {
  const now = Date.now();
  return { id, username: id, email: null, displayName: id, avatarUrl: null, isAnonymous: false, createdAt: now, updatedAt: now, ...overrides };
}
