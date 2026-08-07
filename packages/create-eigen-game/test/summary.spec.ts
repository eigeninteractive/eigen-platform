import { describe, expect, it } from "vitest";
import type { GitOutcome, ScaffoldResult } from "../src/index.js";
import { summarise } from "../src/summary.js";

const result = (git: GitOutcome): ScaffoldResult => ({ root: "/tmp/go-fish", name: "go-fish", git });

describe("summarise", () => {
  it("names both halves of the project it just wrote", () => {
    const text = summarise(result("committed"), "pnpm", false);

    expect(text).toContain("go-fish is ready, at /tmp/go-fish");
    // The pair is the whole point of the combined scaffold, and neither path
    // is discoverable from the wall of output above this.
    expect(text).toContain("server/src/module/v1.ts");
    expect(text).toContain("app/lib/game/v1/rules.dart");
    expect(text).toContain("https://eigeninteractive.com");
  });

  it("reports the repository only when there is something to report", () => {
    expect(summarise(result("committed"), "pnpm", false)).toContain('Committed as "Scaffold go-fish"');
    expect(summarise(result("existing"), "pnpm", false)).toContain("nothing was committed");

    // `failed` has already warned with the command to run; `skipped` was asked
    // for. Repeating either here would be noise in the one block that is read.
    for (const outcome of ["failed", "skipped"] as const) {
      const text = summarise(result(outcome), "pnpm", false);
      expect(text).not.toContain("Committed");
      expect(text).not.toContain("committed");
    }
  });

  it("quotes commands in the manager the project was scaffolded with", () => {
    expect(summarise(result("committed"), "pnpm", false)).toContain("cd server && pnpm test:watch");
    expect(summarise(result("committed"), "npm", false)).toContain("cd server && npm run test:watch");
  });

  it("mentions the missing workflows only when they were not emitted", () => {
    expect(summarise(result("committed"), "pnpm", false)).toContain("create-eigen-game add ci");
    expect(summarise(result("committed"), "pnpm", true)).not.toContain("add ci");
  });
});
