import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FLOORS, nextFloor, releases, rewriteConstant, rewriteExpectations } from "../scripts/set-pins.mjs";

// Plain JavaScript on purpose: `scripts/` is release tooling that `tsconfig.json`
// does not compile, and a `.ts` test would be the only thing asking it to.

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(packageRoot, path), "utf8");

describe("nextFloor", () => {
  it("raises to the exact released version, not to the bottom of its line", () => {
    // `^0.4.0` would protect the same line and still be wrong: it also resolves
    // 0.4.0, which is missing whatever 0.4.1 added.
    expect(nextFloor("^0.4.0", "0.4.1", "eigen_flutter")).toBe("^0.4.1");
    expect(nextFloor("^0.11.0", "0.12.0", "eigen_flutter")).toBe("^0.12.0");
  });

  it("leaves a floor that already names the released version", () => {
    expect(nextFloor("^0.3.1", "0.3.1", "eigen_shell")).toBeUndefined();
  });

  it("refuses to lower a floor", () => {
    // The repository and the release disagree about what exists. Picking either
    // one silently is how a scaffold ends up pinned to a version pub.dev has
    // never seen.
    expect(() => nextFloor("^0.4.0", "0.3.9", "eigen_firebase")).toThrow(/would lower it/);
  });

  it("rejects a floor that is not a caret on an exact version", () => {
    expect(() => nextFloor(">=0.3.0 <0.4.0", "0.3.1", "eigen_shell")).toThrow(/caret on an exact version/);
  });
});

describe("releases", () => {
  it("skips the packages released alongside but never pinned", () => {
    expect(releases(["eigen_api=0.8.0", "eigen_client=0.3.0", "eigen_shell=0.3.1"])).toEqual(new Map([["eigen_shell", "0.3.1"]]));
  });

  it("rejects a package the scaffolder does not pin", () => {
    expect(() => releases(["eigen_fluter=0.12.0"])).toThrow(/not a package the scaffolder pins/);
  });

  it("rejects a version that is not exact", () => {
    expect(() => releases(["eigen_shell=^0.3.1"])).toThrow(/exact x\.y\.z version/);
  });
});

describe("rewriting", () => {
  it("insists a constant appears exactly once", () => {
    expect(rewriteConstant('const flutterShellVersion = "^0.3.0";', "flutterShellVersion", "^0.3.1")).toBe('const flutterShellVersion = "^0.3.1";');
    expect(() => rewriteConstant("nothing here", "flutterShellVersion", "^0.3.1")).toThrow(/found 0/);
  });

  it("insists the expectations it rewrites are the ones it expected to find", () => {
    // A rewrite that quietly matches nothing leaves the unit test asserting the
    // old floor, and the failure surfaces somewhere unrelated.
    expect(() => rewriteExpectations('"eigen_shell@^0.3.0"', "eigen_shell", "^0.3.1", 2)).toThrow(/found 1/);
  });
});

// The counts above are only as good as their agreement with the real files, and
// nothing else notices when someone writes another expectation.
describe("the files it rewrites", () => {
  const source = read("src/index.ts");
  const spec = read("test/scaffold.spec.ts");

  it.each(Object.entries(FLOORS))("finds %s's floor and its expectations", (name, constant) => {
    const current = new RegExp(`const ${constant} = "(\\^\\d+\\.\\d+\\.\\d+)"`).exec(source)?.[1];
    expect(current, `${constant} is not a caret on an exact version in src/index.ts`).toBeTruthy();
    expect(spec).toContain(`${name}@${current}`);
    expect(() => rewriteConstant(source, constant, "^9.9.9")).not.toThrow();
  });
});
