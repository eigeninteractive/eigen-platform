/**
 * The D1 failure predicates. D1 exposes no structured error code — the thrown
 * Error carries only `message` and a nested `cause` (verified against the live
 * binding; Cloudflare documents `e.message` as the only thing to inspect) — so
 * these match text, and these tests pin the exact shapes they must classify.
 *
 * The message shapes below are transcribed from real failures raised by the
 * binding, not invented: the `db.batch()` path surfaces the D1 error directly
 * while the query builder wraps it in drizzle's own message, and the two put
 * the constraint text at different depths.
 */

import { describe, expect, it } from "vitest";
import { isShortCodeCollision, isUniqueViolation, matchesCause } from "../src/d1/errors.js";

/** The real `db.batch()` shape: D1's error, with SQLite's underneath. */
function batchShape(constraint: string): Error {
  return new Error(`D1_ERROR: UNIQUE constraint failed: ${constraint}: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)`, {
    cause: new Error(`UNIQUE constraint failed: ${constraint}: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)`),
  });
}

/** The real query-builder shape: drizzle's `DrizzleQueryError` message carries
 * the SQL — which names `short_code` as a column — and does NOT carry the
 * constraint text. That only appears one `cause` deeper. */
function queryBuilderShape(constraint: string): Error {
  const sql = 'insert into "games" ("id", "status", "short_code", "created_at") values (?, ?, ?, ?)';
  return new Error(`Failed query: ${sql}\nparams: abc,waiting,ZZZZZZ,123`, { cause: batchShape(constraint) });
}

describe("matchesCause", () => {
  it("walks the cause chain rather than testing the top message alone", () => {
    expect(matchesCause(queryBuilderShape("games.short_code"), /UNIQUE constraint failed/i)).toBe(true);
  });

  it("terminates on a self-referential cause instead of spinning", () => {
    const looped = new Error("outer") as Error & { cause: unknown };
    looped.cause = looped;
    expect(matchesCause(looped, /never matches/)).toBe(false);
  });

  it("is false for a non-Error", () => {
    expect(matchesCause("UNIQUE constraint failed: games.short_code", /UNIQUE/)).toBe(false);
  });
});

describe("isUniqueViolation", () => {
  it("matches at every depth the two statement forms produce", () => {
    expect(isUniqueViolation(batchShape("games.short_code"))).toBe(true);
    expect(isUniqueViolation(queryBuilderShape("users.username"))).toBe(true);
  });

  it("does not match an unrelated failure", () => {
    expect(isUniqueViolation(new Error("D1_ERROR: no such column: foo"))).toBe(false);
  });
});

describe("isShortCodeCollision", () => {
  it("matches the collision the create loop retries on, in both statement forms", () => {
    expect(isShortCodeCollision(batchShape("games.short_code"))).toBe(true);
    expect(isShortCodeCollision(queryBuilderShape("games.short_code"))).toBe(true);
  });

  it("matches when short_code is one column of a composite index", () => {
    expect(isShortCodeCollision(batchShape("games.access, games.short_code"))).toBe(true);
  });

  // The precision that matters: retrying only ever helps a short-code clash.
  // Treating another column's UNIQUE violation as one burns the whole retry
  // budget and then surfaces the original error anyway.
  it("does not match a UNIQUE violation on a different column", () => {
    expect(isShortCodeCollision(batchShape("games.id"))).toBe(false);
    expect(isShortCodeCollision(batchShape("users.username"))).toBe(false);
  });

  // The query-builder message embeds SQL naming `short_code` as a column, so a
  // looser pattern would read this as a code collision.
  it("does not match when short_code appears only in the embedded SQL", () => {
    expect(isShortCodeCollision(queryBuilderShape("games.id"))).toBe(false);
  });

  it("does not match a non-UNIQUE failure that mentions the column", () => {
    expect(isShortCodeCollision(new Error("D1_ERROR: NOT NULL constraint failed: games.short_code"))).toBe(false);
  });
});
