#!/usr/bin/env node
/**
 * Regenerate the API reference from the sibling engine checkout.
 *
 * The reference is *derived*, not authored: it is generated here and then
 * committed, so `git clone eigen-web && pnpm build` works with no sibling
 * repositories present. Run this after the engine's public surface changes:
 *
 *     pnpm sync-api
 *
 * It does three things:
 *
 *   1. copies the engine's emitted `openapi.json` in, both as the generator's
 *      input and as a static file — `/openapi.json` is the machine-readable
 *      HTTP contract, which is what an agent should read instead of a prose
 *      rendering of it;
 *   2. runs TypeDoc over the package barrels (see `typedoc.config.mjs`);
 *   3. runs `docusaurus gen-api-docs` to turn the spec into MDX pages.
 *
 * Step 2's output is renamed on the way through: TypeDoc names files after the
 * module, so `@eigeninteractive/server/testing` lands as `@eigeninteractive.server.testing.md` and
 * would be served from a URL with an `@` in it. We flatten those to plain
 * slugs and rewrite the cross-links to match.
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const engineDir = join(siteDir, "..", "eigen-server");
const tsDocsDir = join(siteDir, "docs", "reference", "typescript");

const run = (cmd, args) => execFileSync(cmd, args, { cwd: siteDir, stdio: "inherit" });
const step = (msg) => console.log(`\n\x1b[36m▸ ${msg}\x1b[0m`);

// A module name becomes a file slug: "@eigeninteractive/server/testing" arrives as
// "@eigeninteractive.server.testing.md" and leaves as "server-testing.md". Namespace
// pages carry a literal "Namespace" segment we drop.
const slugFor = (file) =>
  `${file
    .replace(/\.md$/, "")
    .replace(/^@eigeninteractive\./, "")
    .replace(/\.Namespace\./g, ".")
    .replace(/\./g, "-")
    .toLowerCase()}.md`;

step("Copying openapi.json from the engine");
const spec = join(engineDir, "packages", "server", "openapi.json");
mkdirSync(join(siteDir, "api"), { recursive: true });
copyFileSync(spec, join(siteDir, "api", "openapi.json"));
copyFileSync(spec, join(siteDir, "static", "openapi.json"));
console.log(`  ${spec} → api/openapi.json, static/openapi.json`);

step("Generating the TypeScript reference (typedoc)");
rmSync(tsDocsDir, { recursive: true, force: true });
run("pnpm", ["exec", "typedoc"]);

step("Normalising generated filenames");
const generated = readdirSync(tsDocsDir).filter((f) => f.endsWith(".md"));
const renames = new Map(generated.filter((f) => f !== "index.md").map((f) => [f, slugFor(f)]));

for (const file of generated) {
  const path = join(tsDocsDir, file);
  let body = readFileSync(path, "utf8");
  // Rewrite every cross-link before the files move underneath them.
  for (const [from, to] of renames) {
    body = body.replaceAll(`](${from})`, `](${to})`).replaceAll(`](${from}#`, `](${to}#`);
  }
  // TypeDoc occasionally leaves padding after multiline signature parameters.
  // Keep committed generated docs friendly to repository-wide whitespace checks.
  body = body
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
  writeFileSync(path, body);
}
for (const [from, to] of renames) {
  renameSync(join(tsDocsDir, from), join(tsDocsDir, to));
  console.log(`  ${from} → ${to}`);
}

// TypeDoc's default module list is technically correct but gives a game
// implementor no clue which package to open first. Keep the declarations
// generated while owning this small task-oriented landing page here.
writeFileSync(
  join(tsDocsDir, "index.md"),
  `# TypeScript API

This reference is generated from the published package barrels. Start with the
package that owns the task you are doing:

| Package | Open it when you need to… |
|---|---|
| [\`@eigeninteractive/rules\`](rules.md) | Implement a \`GameModule\`, payload schemas, hooks, observations, ratings, or bots. This is where most game code lives. |
| [\`@eigeninteractive/server\`](server.md) | Compose the Cloudflare Worker with \`createEngine\`, \`BaseGameDO\`, bindings, deep links, avatars, or the public site. |
| [\`@eigeninteractive/testkit\`](testkit.md) | Run twin fixtures, emit/check \`game-contract.json\`, or drive rules through the kernel in tests. |
| [\`@eigeninteractive/server/testing\`](server-testing.md) | Mint local Firebase-compatible tokens for Worker integration tests. Never use it in production code. |

Game Workers depend directly on \`rules\` and \`server\`; \`testkit\` and
\`server/testing\` are test-only. The [task guides](../../build-a-game/the-contract.md)
show how the TypeScript and Dart halves fit together.

The kernel and storage-schema pages are engine internals. They remain available
for debugging and contributors, but a game should not import them to implement
rules or deploy a Worker.
`,
);

step("Generating the HTTP reference (openapi)");
rmSync(join(siteDir, "docs", "reference", "http-api"), { recursive: true, force: true });
run("pnpm", ["exec", "docusaurus", "gen-api-docs", "all"]);

console.log("\n\x1b[32m✓ API reference synced.\x1b[0m Review the diff and commit it.\n");
