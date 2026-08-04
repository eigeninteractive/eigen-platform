#!/usr/bin/env node

// Releases `create-eigen-game` whenever the engine crosses a compatibility
// line. Runs as the first step of `pnpm version-packages`, so its effect is a
// bump visible in the version pull request rather than a separate action.
//
// ── Why this exists ───────────────────────────────────────────────────────────
//
// The scaffolder emits the engine range it was compiled against, read from its
// own `@eigeninteractive/server` devDependency. That makes the requirement
// one-directional: the scaffolder must follow the engine, but the engine must
// NOT follow the scaffolder — a template typo should never move four published
// packages onto a new version line.
//
// `create-eigen-game` used to be in the `fixed` changesets group, which does
// guarantee the first half, but only by also enforcing the second: it is
// symmetric by definition. That is how a scaffolder-only change proposed
// bumping the whole engine to 0.3.0.
//
// Changesets has no one-way form. `linked` shares versions only among packages
// already being released and would let the scaffolder's number drift above the
// engine's; and while `workspace:*` IS resolved for the out-of-range check, the
// dependent-bump logic maps `devDependencies` to `type: "none"`, so the
// dependency alone will never trigger a release. Moving the engine into real
// `dependencies` would work and would make `npx create-eigen-game` download
// hono, jose and zod that it never imports.
//
// So the direction is expressed here instead, where it can be read.
//
// ── Why only a LINE change ────────────────────────────────────────────────────
//
// The emitted range is a caret, so an engine patch or in-line minor is already
// covered by scaffolders on npm: `^0.2.0` picks up 0.2.7 by itself. Only
// crossing to a new line leaves the published scaffolder pointing at an engine
// consumers should no longer start on — and pre-1.0 that crossing is a breaking
// change that usually edits the templates anyway.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ENGINE = "@eigeninteractive/server";
const SCAFFOLDER = "create-eigen-game";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const changesetPath = resolve(repositoryRoot, ".changeset", "create-eigen-game-follows-the-engine.md");

/**
 * The compatibility line a caret range protects: the minor pre-1.0, since
 * `^0.2.0` means `>=0.2.0 <0.3.0`, and the major from 1.0.0 on.
 */
const line = (version) => {
  const [major, minor] = version.split(".");
  return major === "0" ? `0.${minor}` : major;
};

const releasePlan = () => {
  const output = resolve(mkdtempSync(resolve(tmpdir(), "eigen-release-plan-")), "status.json");
  try {
    execFileSync("pnpm", ["exec", "changeset", "status", `--output=${output}`], { cwd: repositoryRoot, stdio: ["ignore", "ignore", "inherit"] });
  } catch {
    // No changesets pending, or changesets could not read the repository.
    // Either way there is no plan to follow, and `changeset version` — which
    // runs next and owns the real error reporting — will say so better.
    return undefined;
  }
  return existsSync(output) ? JSON.parse(readFileSync(output, "utf8")) : undefined;
};

const plan = releasePlan();
const releases = plan?.releases ?? [];

const engine = releases.find((release) => release.name === ENGINE);
if (!engine || engine.type === "none") process.exit(0);

if (line(engine.oldVersion) === line(engine.newVersion)) process.exit(0);

const scaffolder = releases.find((release) => release.name === SCAFFOLDER);
if (scaffolder && scaffolder.type !== "none") process.exit(0);

const from = line(engine.oldVersion);
const to = line(engine.newVersion);

writeFileSync(
  changesetPath,
  `---
"${SCAFFOLDER}": patch
---

Scaffold new projects on engine ${to}.x

\`create-eigen-game\` emits the engine range its templates were compiled
against, so the ${from}.x → ${to}.x move needs a scaffolder release to reach
\`npm create eigen-game\`.
`,
);

// `changeset version` consumes and deletes this file in the next command of
// `version-packages`, so it never reaches a commit — only the resulting bump
// does.
console.log(`Added a ${SCAFFOLDER} release: the engine moves ${from}.x → ${to}.x, and the emitted range follows.`);
