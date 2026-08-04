import { describe, expect, it, vi } from "vitest";
import { engineRange } from "../src/engine-range.js";

// The published branch — a manifest whose `workspace:*` has already been
// rewritten by pnpm — never executes anywhere else. `scaffold.spec.ts` only
// ever runs the workspace branch, and by the time the other one is wrong the
// package is on npm.
describe("engineRange", () => {
  it("carets the version pnpm wrote into the published manifest", () => {
    const sibling = vi.fn();

    expect(engineRange("0.2.0", sibling)).toBe("^0.2.0");
    expect(sibling).not.toHaveBeenCalled();
  });

  it("reads the sibling package when the workspace protocol names no version", () => {
    expect(engineRange("workspace:*", () => "0.3.1")).toBe("^0.3.1");
    expect(engineRange("workspace:^", () => "1.0.0")).toBe("^1.0.0");
  });

  it("refuses a manifest with no engine devDependency", () => {
    expect(() => engineRange(undefined, () => "0.2.0")).toThrow(/no @eigeninteractive\/server devDependency/);
  });

  it("refuses a workspace protocol it cannot resolve", () => {
    expect(() => engineRange("workspace:*", () => undefined)).toThrow(/could not be read/);
  });

  // Guards the caret concatenation. A range here would produce `^^0.2.0`, which
  // npm rejects only once it is inside someone's generated project.
  it("refuses anything that is not an exact version", () => {
    expect(() => engineRange("^0.2.0", () => undefined)).toThrow(/expected an exact/);
    expect(() => engineRange(">=0.2.0 <0.3.0", () => undefined)).toThrow(/expected an exact/);
    expect(() => engineRange("latest", () => undefined)).toThrow(/expected an exact/);
  });
});
