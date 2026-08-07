/**
 * The closing summary, and the only output of a scaffold anyone reads.
 *
 * A run drives several tools with plenty to say, so where the project went,
 * what to edit, and what to run are worth restating at the bottom. Returned in
 * pieces rather than as one block, because the CLI renders each in a different
 * shape: the outcomes as status lines, the commands as a boxed note, the
 * destination as the closing line.
 *
 * Its own module so it can be asserted: `cli.ts` is the bin entry and runs
 * `main` on import, which makes anything defined there untestable. The package
 * `exports` map does not expose this, so it is internal despite being
 * importable by the tests.
 */
import type { PackageManager, ScaffoldResult } from "./index.js";

export interface Summary {
  /** What became of the repository and of Firebase, when there is something to say. */
  status: string[];
  /** The commands worth having, as one block. */
  next: string;
  /** One-line asides, after the block. */
  footnotes: string[];
  /** The closing line. */
  headline: string;
}

/** Two-column rows, aligned to the widest left cell. */
function columns(rows: [string, string][]): string[] {
  const width = Math.max(...rows.map(([left]) => left.length));
  return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`);
}

export function summarise(result: ScaffoldResult, manager: PackageManager, ci: boolean): Summary {
  const run = manager === "npm" ? "npm run" : "pnpm";
  const status: string[] = [];

  // Only the outcomes that leave the reader something to know. `failed` has
  // already warned, in more detail than a summary line could carry.
  if (result.git === "committed") status.push(`Committed as "Scaffold ${result.name}"`);
  if (result.git === "existing") status.push("Created inside a repository you already had, so nothing was committed");
  // `failed` has warned already, and the step reappears below as the next
  // thing to run, which is the whole of the advice.
  if (result.firebase === "configured") status.push(result.git === "committed" ? "Firebase is configured, and everything it generated is in that commit" : "Firebase is configured");

  const next = [
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
      // Named here because it is the one step the game itself cannot do
      // without: rules, fixtures and the Worker all run unconfigured, and the
      // app throws `Firebase is not configured` at launch until this has run
      // once.
      ...(result.firebase === "configured" ? [] : [[`${run} firebase:configure`, "connect Firebase before the app runs"] as [string, string]]),
    ]),
  ].join("\n");

  const footnotes = ["Docs: https://eigeninteractive.com"];
  if (!ci) footnotes.unshift("No CI workflows yet: `create-eigen-game add ci` writes them when shipping is the next step.");

  return { status, next, footnotes, headline: `${result.name} is ready, at ${result.root}` };
}
