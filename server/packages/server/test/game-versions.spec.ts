/** Game version registry validation. HTTP create/join behavior is covered in
 * engine.spec.ts. */

import type { GameModule } from "@eigeninteractive/rules";
import { describe, expect, it } from "vitest";
import { latestSchemaVersion } from "../src/engine.js";

/** Only the `versions` keys matter here; rules units are never invoked. */
const shipping = (...versions: number[]) => ({ versions: Object.fromEntries(versions.map((version) => [version, {}])) }) as unknown as GameModule;

describe("latestSchemaVersion", () => {
  it("accepts a contiguous registry regardless of insertion order", () => {
    expect(latestSchemaVersion(shipping(3, 1, 2))).toBe(3);
  });

  it("allows an empty registry for a game-less deployment", () => {
    expect(latestSchemaVersion(shipping())).toBe(0);
  });

  it("fails fast when a retained version is missing", () => {
    expect(() => latestSchemaVersion(shipping(1, 3))).toThrow(/expected 2, found 3/);
  });

  it("fails fast when version 1 is missing", () => {
    expect(() => latestSchemaVersion(shipping(2))).toThrow(/expected 1, found 2/);
  });
});
