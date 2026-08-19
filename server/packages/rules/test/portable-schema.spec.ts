/**
 * The portable-schema profile, driven by what Zod actually emits.
 *
 * Every accepted form below is real Zod output for an idiom a game needs, and
 * every rejected form is real Zod output for an idiom that would make the
 * generated Dart validator disagree with the server. The profile is a policy
 * about a specific generator's behaviour, so it is tested against that behaviour
 * rather than against the prose.
 */

import { describe, expect, it } from "vitest";
import { assertPortableSchema, portableSchemaViolations } from "../src/portable-schema.js";

const draft = "https://json-schema.org/draft/2020-12/schema";
const object = (properties: Record<string, unknown>) => ({ $schema: draft, type: "object", properties, required: Object.keys(properties), additionalProperties: false });

describe("accepted forms", () => {
  it("accepts a closed object of scalars", () => {
    expect(portableSchemaViolations(object({ round: { type: "integer", minimum: 1 } }))).toEqual([]);
  });

  it("accepts a length-bounded array, the portable spelling of a fixed tuple", () => {
    // What `z.array(x).length(2)` emits. Unlike prefixItems this actually bounds
    // the length, so a generated validator rejects a third element exactly as the
    // authoring library does.
    expect(portableSchemaViolations(object({ wins: { type: "array", items: { type: "integer" }, minItems: 2, maxItems: 2 } }))).toEqual([]);
  });

  it("accepts anyOf as a nullable wrapper", () => {
    // The only encoding Zod has for `.nullable()`, and equivalent to the
    // `type: [T, "null"]` union the profile already allows.
    expect(portableSchemaViolations(object({ lastRound: { anyOf: [{ $ref: "#/$defs/Round" }, { type: "null" }] } }))).toEqual([]);
  });

  it("accepts a local $defs reference", () => {
    expect(portableSchemaViolations({ ...object({ move: { $ref: "#/$defs/Move" } }), $defs: { Move: { type: "string", enum: ["rock"] } } })).toEqual([]);
  });
});

describe("rejected forms", () => {
  it("rejects prefixItems, which does not bound the array length", () => {
    // The defect this profile check exists to catch: `z.tuple([Move, Move])`
    // emits this, and it validates a three-element array that Zod rejects.
    const violations = portableSchemaViolations(object({ moves: { type: "array", prefixItems: [{ type: "string" }, { type: "string" }] } }));
    expect(violations).toEqual([
      { pointer: "/properties/moves/prefixItems", problem: "keyword is outside the portable profile" },
      { pointer: "/properties/moves", problem: "array schemas require items (use items with minItems/maxItems for a fixed length)" },
    ]);
  });

  it("rejects an open object, which lets a generated validator accept a stripped key", () => {
    expect(portableSchemaViolations({ $schema: draft, type: "object", properties: {}, required: [] })).toEqual([{ pointer: "/", problem: "object schemas require additionalProperties: false" }]);
  });

  it("rejects a general anyOf while accepting the nullable one", () => {
    const violations = portableSchemaViolations(object({ winner: { anyOf: [{ const: 0 }, { const: 1 }] } }));
    expect(violations).toHaveLength(1);
    expect(violations[0]?.pointer).toBe("/properties/winner/anyOf");
  });

  it("rejects a nested union inside a nullable wrapper", () => {
    // `z.union([literal(0), literal(1)]).nullable()`. The fix is `z.literal([0, 1])`,
    // which emits a portable `enum`.
    const violations = portableSchemaViolations(object({ winner: { anyOf: [{ anyOf: [{ const: 0 }, { const: 1 }] }, { type: "null" }] } }));
    expect(violations.map((v) => v.pointer)).toEqual(["/properties/winner/anyOf/0/anyOf"]);
  });

  it("rejects remote references and the wrong draft", () => {
    expect(portableSchemaViolations({ $schema: "http://json-schema.org/draft-07/schema#", $ref: "https://example.com/x.json" }).map((v) => v.pointer)).toEqual(["/$schema", "/$ref"]);
  });

  it("reports every violation at once, not just the first", () => {
    const violations = portableSchemaViolations({ $schema: draft, type: "object", properties: { a: { type: "object", properties: {} }, b: { allOf: [] } }, required: [] });
    expect(violations.length).toBeGreaterThan(2);
  });
});

describe("assertPortableSchema", () => {
  it("names the payload and every pointer", () => {
    expect(() => assertPortableSchema({ type: "object", properties: {} }, "v1 state")).toThrow(/v1 state is outside the portable schema profile[\s\S]*additionalProperties: false/);
  });

  it("stays silent on a portable schema", () => {
    expect(() => assertPortableSchema(object({}), "v1 config")).not.toThrow();
  });
});
