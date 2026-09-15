import { describe, expect, it } from "vitest";
import { emittedFloors, satisfies } from "../scripts/check-pins.mjs";

describe("satisfies", () => {
  // Pub's caret is not npm's below 1.0, and the difference is exactly the line
  // every package in this repository is on.
  it("stops at the next minor below 1.0", () => {
    expect(satisfies("0.11.0", "^0.11.0")).toBe(true);
    expect(satisfies("0.11.4", "^0.11.0")).toBe(true);
    expect(satisfies("0.10.9", "^0.11.0")).toBe(false);
    expect(satisfies("0.12.0", "^0.11.0")).toBe(false);
  });

  it("keeps the patch floor meaningful", () => {
    expect(satisfies("0.4.0", "^0.4.1")).toBe(false);
    expect(satisfies("0.4.1", "^0.4.1")).toBe(true);
  });

  it("stops at the next major from 1.0", () => {
    expect(satisfies("1.9.9", "^1.2.0")).toBe(true);
    expect(satisfies("2.0.0", "^1.2.0")).toBe(false);
    expect(satisfies("1.1.9", "^1.2.0")).toBe(false);
  });

  it("treats a prerelease as no match", () => {
    // pub.dev serves them and a solver will not choose one for a caret range,
    // so counting one as a match would clear this gate on nothing installable.
    expect(satisfies("0.12.0-dev.1", "^0.12.0")).toBe(false);
  });
});

describe("emittedFloors", () => {
  it("fails loudly rather than checking nothing", () => {
    expect(() => emittedFloors("a source file with no floors in it")).toThrow(/no floor to check/);
  });
});
