import { describe, expect, it } from "vitest";
import type { GitOutcome, ScaffoldResult } from "../src/index.js";
import { summarise } from "../src/summary.js";

const result = (git: GitOutcome, firebase: ScaffoldResult["firebase"] = "skipped"): ScaffoldResult => ({ root: "/tmp/go-fish", name: "go-fish", git, firebase });

/** Everything the summary would put on screen, for the assertions that do not care where. */
const rendered = (...args: Parameters<typeof summarise>): string => {
  const { status, next, footnotes, headline } = summarise(...args);
  return [...status, next, ...footnotes, headline].join("\n");
};

describe("summarise", () => {
  it("names both halves of the project it just wrote", () => {
    const { next, headline } = summarise(result("committed"), "pnpm", false);

    expect(headline).toBe("go-fish is ready, at /tmp/go-fish");
    // The pair is the whole point of the combined scaffold, and neither path
    // is discoverable from the wall of output above this.
    expect(next).toContain("server/src/module/v1.ts");
    expect(next).toContain("app/lib/game/v1/rules.dart");
    expect(rendered(result("committed"), "pnpm", false)).toContain("https://eigeninteractive.com");
  });

  it("reports the repository only when there is something to report", () => {
    expect(summarise(result("committed"), "pnpm", false).status).toContain('Committed as "Scaffold go-fish"');
    expect(rendered(result("existing"), "pnpm", false)).toContain("nothing was committed");

    // `failed` has already warned with the command to run; `skipped` was asked
    // for. Repeating either here would be noise in the one block that is read.
    for (const outcome of ["failed", "skipped"] as const) {
      expect(summarise(result(outcome), "pnpm", false).status).toEqual([]);
    }
  });

  it("quotes commands in the manager the project was scaffolded with", () => {
    expect(summarise(result("committed"), "pnpm", false).next).toContain("cd server && pnpm test:watch");
    expect(summarise(result("committed"), "npm", false).next).toContain("cd server && npm run test:watch");
  });

  it("keeps naming the Firebase step until it has been done", () => {
    // The app throws `Firebase is not configured` at launch until this has run
    // once, so it belongs with the other things to run next, and stops
    // belonging there the moment the scaffold did it.
    expect(summarise(result("committed"), "pnpm", false).next).toContain("pnpm firebase:configure");
    expect(summarise(result("committed", "failed"), "pnpm", false).next).toContain("pnpm firebase:configure");
    expect(summarise(result("committed", "configured"), "pnpm", false).next).not.toContain("firebase:configure");
  });

  it("says what the Firebase step left behind, when it ran", () => {
    expect(summarise(result("committed", "configured"), "pnpm", false).status).toContain("Firebase is configured, and everything it generated is in that commit");
    // Nothing to be in, so nothing to claim.
    expect(summarise(result("skipped", "configured"), "pnpm", false).status).toContain("Firebase is configured");
  });

  it("names what the scaffold filled in, and only what the console still owes", () => {
    const linked = { ...result("committed", "configured"), link: { projectId: "go-fish-1a2b3", googleWebClientId: "1-web.apps.googleusercontent.com" } };
    const { status, next } = summarise(linked, "pnpm", false);

    expect(status.join("\n")).toContain("FIREBASE_PROJECT_ID is set to go-fish-1a2b3");
    // The one value no CLI can produce, so it survives every path.
    expect(next).toContain("FIREBASE_VAPID_KEY");
    // Found, so there is nothing to enable and nothing to paste.
    expect(next).not.toContain("Enable Google sign-in");
    expect(next).not.toContain("GOOGLE_WEB_CLIENT_ID");
  });

  it("asks for the sign-in provider when Firebase had not created its client yet", () => {
    const unlinked = { ...result("committed", "configured"), link: { projectId: "go-fish-1a2b3", googleWebClientId: null } };

    expect(summarise(unlinked, "pnpm", false).next).toContain("Enable Google sign-in");
    expect(summarise(unlinked, "pnpm", false).next).toContain("GOOGLE_WEB_CLIENT_ID");
  });

  it("says nothing about console values when Firebase never ran", () => {
    // Nothing was read, so nothing is known to be missing, and the step to run
    // is `firebase:configure` rather than a list of fields.
    expect(summarise(result("committed"), "pnpm", false).next).not.toContain("FIREBASE_VAPID_KEY");
  });

  it("mentions the missing workflows only when they were not emitted", () => {
    expect(summarise(result("committed"), "pnpm", false).footnotes.join("\n")).toContain("create-eigen-game add workflows");
    expect(summarise(result("committed"), "pnpm", true).footnotes.join("\n")).not.toContain("add workflows");
  });
});
