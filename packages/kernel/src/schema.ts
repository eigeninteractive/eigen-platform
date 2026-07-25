/**
 * The version boundary — payload parsing through a unit's Standard Schemas.
 * The kernel parses every payload with the resolved version unit's schemas
 * before invoking its hooks, so hook bodies never see unvalidated JSON — and
 * never another version's shape.
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";
import { GameBugError } from "./errors.js";

/** A client payload parse: refusal is the caller's fault, so failure comes
 * back as a value for `commit()` to turn into a rejection. */
export type ParseResult<T> = { ok: true; value: T } | { ok: false; message: string };

function issueSummary(issues: readonly StandardSchemaV1.Issue[]): string {
  return issues
    .map((issue) => {
      const path = issue.path?.map((p) => (typeof p === "object" ? p.key : p)).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

/** Run a Standard Schema synchronously. The contract requires sync schemas
 * (an async refinement inside a pure, serialized commit has no sane meaning),
 * so a Promise result is a game bug. */
function validateSync<T>(schema: StandardSchemaV1<unknown, T>, value: unknown): StandardSchemaV1.Result<T> {
  const result = schema["~standard"].validate(value);
  if (result instanceof Promise) {
    throw new GameBugError("game schema validated asynchronously — engine schemas must be sync");
  }
  return result;
}

/** Parse a client-submitted payload (an action's `data`, a create request's
 * `config`) through its schema. Failure is the caller's fault. Returns the
 * parsed value, so what flows onward — into hooks and the action log — is the
 * sanitized shape (unknown keys stripped, defaults applied), never the raw
 * submission. */
export function parseClientPayload<T>(schema: StandardSchemaV1<unknown, T>, value: unknown, what: string): ParseResult<T> {
  const result = validateSync(schema, value);
  if (result.issues) {
    return { ok: false, message: `Invalid ${what}: ${issueSummary(result.issues)}` };
  }
  return { ok: true, value: result.value };
}

/** Parse a stored payload (a state row, the game's config) through its
 * schema. Failure means corrupted data or a schema that no longer matches
 * what this version historically wrote — an engine-side bug, thrown. */
export function parseStoredPayload<T>(schema: StandardSchemaV1<unknown, T>, value: unknown, what: string, schemaVersion: number): T {
  const result = validateSync(schema, value);
  if (result.issues) {
    throw new GameBugError(`Stored ${what} failed validation for schemaVersion ` + `${schemaVersion}: ${issueSummary(result.issues)}`);
  }
  return result.value;
}
