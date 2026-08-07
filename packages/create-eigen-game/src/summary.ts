/**
 * The closing summary, and the only output of a scaffold anyone reads.
 *
 * A run prints several screens that belong to other tools — pnpm's `dlx`
 * install, `flutter create`, pub, two icon generators, the server install — so
 * the single line this used to end on was indistinguishable from the noise
 * above it. Where the project went, what to edit, and what to run are worth
 * restating at the bottom.
 *
 * Its own module so it can be asserted: `cli.ts` is the bin entry and runs
 * `main` on import, which makes anything defined there untestable. The package
 * `exports` map does not expose this, so it is internal despite being
 * importable by the tests.
 */
import type { PackageManager, ScaffoldResult } from "./index.js";

/** Two-column rows, aligned to the widest left cell. */
function columns(rows: [string, string][]): string[] {
  const width = Math.max(...rows.map(([left]) => left.length));
  return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`);
}

export function summarise(result: ScaffoldResult, manager: PackageManager, ci: boolean): string {
  const run = manager === "npm" ? "npm run" : "pnpm";
  const lines = ["", `${result.name} is ready, at ${result.root}`];

  // Only the outcomes that leave the reader something to know. `failed` has
  // already warned, in more detail than a summary line could carry.
  if (result.git === "committed") lines.push(`Committed as "Scaffold ${result.name}".`);
  if (result.git === "existing") lines.push("Created inside a repository you already had, so nothing was committed.");

  lines.push(
    "",
    "Write the game",
    ...columns([
      ["server/src/module/v1.ts", "the authoritative rules"],
      ["app/lib/game/v1/rules.dart", "the presentation twin"],
    ]),
    "",
    `Then, from ${result.name}/`,
    ...columns([
      [`cd server && ${run} test:watch`, "rules and twin fixtures"],
      [`cd server && ${run} dev`, "the Worker, on http://localhost:8787"],
      [`${run} contract`, "regenerate after a schema change"],
    ]),
    "",
  );

  if (!ci) lines.push("No CI workflows yet: `create-eigen-game add ci` writes them when shipping is the next step.");
  lines.push("Docs: https://eigeninteractive.com");

  return lines.join("\n");
}
