import type { Envelope } from "@eigen/rules";
import { describe, expect, it } from "vitest";
import { GameBugError } from "../src/errors.js";
import { assertBudgetPending, assertForfeitPending, assertHookState, assertPendingIdentified, canonicalJson, sameView } from "../src/guards.js";
import { parseClientPayload, parseStoredPayload } from "../src/schema.js";
import { asyncSchema, schemaOf, turnRules } from "./helpers.js";

const envelope = (pending: number[]): Envelope => ({
  state: { count: 1 },
  pending_players: pending,
});

describe("canonicalJson", () => {
  it("is insensitive to object key order", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(canonicalJson({ a: [2, { c: 4, d: 3 }], b: 1 }));
  });

  it("treats undefined object values as absent", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });

  it("keeps array order significant", () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it("distinguishes null from a missing key inside objects", () => {
    expect(canonicalJson({ a: null })).not.toBe(canonicalJson({}));
  });
});

describe("sameView", () => {
  it("matches structurally equal views regardless of construction order", () => {
    expect(sameView({ data: { board: [1, 2], you: 0 }, pending_players: [0] }, { data: { you: 0, board: [1, 2] }, pending_players: [0] })).toBe(true);
  });

  it("differs when the data changed", () => {
    expect(sameView({ data: { board: [1, 2] }, pending_players: [0] }, { data: { board: [1, 3] }, pending_players: [0] })).toBe(false);
  });

  it("differs when the observed pending set changed", () => {
    expect(sameView({ data: { board: [1] }, pending_players: [0, 1] }, { data: { board: [1] }, pending_players: [0] })).toBe(false);
  });
});

describe("hook guards", () => {
  it("assertHookState passes a schema-conforming state", () => {
    expect(() => assertHookState(turnRules.schemas, envelope([0]), 1)).not.toThrow();
  });

  it("assertHookState throws on a malformed state", () => {
    const bad: Envelope = { state: { nope: true }, pending_players: [0] };
    expect(() => assertHookState(turnRules.schemas, bad, 1)).toThrow(GameBugError);
  });

  it("assertBudgetPending rejects multi-seat pending in budget mode only", () => {
    expect(() => assertBudgetPending(60, envelope([0, 1]), 1)).toThrow(GameBugError);
    expect(() => assertBudgetPending(60, envelope([0]), 1)).not.toThrow();
    expect(() => assertBudgetPending(null, envelope([0, 1]), 1)).not.toThrow();
  });

  it("assertForfeitPending rejects a forfeited seat left pending", () => {
    expect(() => assertForfeitPending(1, envelope([1]), 1)).toThrow(GameBugError);
    expect(() => assertForfeitPending(1, envelope([0]), 1)).not.toThrow();
  });

  it("assertPendingIdentified rejects a pending seat with no identity", () => {
    const roster = [
      { player_index: 0, user_id: "u", bot_id: null },
      { player_index: 1, user_id: null, bot_id: null }, // purged
    ];
    expect(() => assertPendingIdentified(roster, envelope([1]), 1)).toThrow(GameBugError);
    expect(() => assertPendingIdentified(roster, envelope([0]), 1)).not.toThrow();
  });
});

describe("schema boundary", () => {
  it("parseClientPayload returns a failure value for the caller's fault", () => {
    const result = parseClientPayload(
      schemaOf<{ n: number }>((_v) => false),
      { n: "x" },
      "action",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Invalid action");
  });

  it("parseStoredPayload throws for corrupted stored data", () => {
    expect(() =>
      parseStoredPayload(
        schemaOf((_v) => false),
        {},
        "state",
        3,
      ),
    ).toThrow(/schema_version 3/);
  });

  it("rejects an async schema as a game bug", () => {
    expect(() => parseStoredPayload(asyncSchema(), {}, "state", 1)).toThrow(GameBugError);
  });
});
