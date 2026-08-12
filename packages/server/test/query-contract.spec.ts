/**
 * One invariant over the whole published surface: **no query parameter may be
 * nullable.**
 *
 * This is the guard that replaced a request-rewriting middleware, and it is a
 * better guard because it fails at build time instead of compensating at
 * runtime. The bug it exists to prevent is not obvious from any single line of
 * code, because every layer involved behaves correctly:
 *
 * `z.coerce.number()` is `Number()`, and `Number(null)` is `0`. So
 * `z.coerce.number().int().min(0)` genuinely accepts null, the emitted schema
 * honestly reports `["integer", "null"]`, and `openapi-generator` correctly
 * drops its `if (x != null)` guard - the API said null was welcome. dio then
 * renders that null as a bare `?to=`, which the server coerces straight back to
 * `0`. A caller asking for the first page of a list gets an empty one, with a
 * 200, and nothing anywhere logs a problem.
 *
 * The tell is upstream of all of it and is visible right here: a query
 * parameter that accepts null. A parameter can be *optional* - you may omit it
 * - without being *nullable* - you may send it as null. Conflating those is
 * what generates the whole chain, and `.min(1)` versus `.min(0)` was enough to
 * flip it, which is not a difference anyone would notice in review.
 */

import { describe, expect, it } from "vitest";
import { openApiDocument } from "../src/openapi.js";

interface QueryParam {
  operationId: string;
  name: string;
  type: unknown;
}

function queryParams(): QueryParam[] {
  const doc = openApiDocument("0.0.0-test") as unknown as {
    paths: Record<string, Record<string, { operationId?: string; parameters?: { in: string; name: string; schema?: { type?: unknown } }[] }>>;
  };
  const found: QueryParam[] = [];
  for (const operations of Object.values(doc.paths)) {
    for (const operation of Object.values(operations)) {
      for (const parameter of operation.parameters ?? []) {
        if (parameter.in === "query") found.push({ operationId: operation.operationId ?? "?", name: parameter.name, type: parameter.schema?.type });
      }
    }
  }
  return found;
}

describe("query parameter contract", () => {
  it("finds the query parameters at all", () => {
    // Guards the guard: if the document shape ever changes under this, the
    // assertion below would pass by inspecting nothing.
    expect(queryParams().length).toBeGreaterThan(10);
  });

  it("declares no query parameter as nullable", () => {
    const nullable = queryParams().filter((p) => Array.isArray(p.type) && (p.type as unknown[]).includes("null"));
    expect(nullable.map((p) => `${p.operationId}.${p.name}`)).toEqual([]);
  });

  // The mechanism, pinned separately so the diagnosis survives even if someone
  // "fixes" the assertion above by hand-editing a type.
  it("is what z.coerce would have broken", async () => {
    const { z } = await import("zod");
    expect(z.coerce.number().int().min(0).safeParse(null).success).toBe(true);
    expect(z.coerce.number().int().min(0).safeParse("").success).toBe(true);
  });
});
