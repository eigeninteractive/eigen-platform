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
 *   2. runs TypeDoc over the package barrels (see `typedoc.json`);
 *   3. runs `docusaurus gen-api-docs` to turn the spec into MDX pages.
 *
 * Step 2's output is renamed on the way through: TypeDoc names files after the
 * module, so `@eigen/server/testing` lands as `@eigen.server.testing.md` and
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

// A module name becomes a file slug: "@eigen/server/testing" arrives as
// "@eigen.server.testing.md" and leaves as "server-testing.md". Namespace
// pages carry a literal "Namespace" segment we drop.
const slugFor = (file) =>
  `${file
    .replace(/\.md$/, "")
    .replace(/^@eigen\./, "")
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
  writeFileSync(path, body);
}
for (const [from, to] of renames) {
  renameSync(join(tsDocsDir, from), join(tsDocsDir, to));
  console.log(`  ${from} → ${to}`);
}

step("Generating the HTTP reference (openapi)");
rmSync(join(siteDir, "docs", "reference", "http-api"), { recursive: true, force: true });
run("pnpm", ["exec", "docusaurus", "gen-api-docs", "all"]);

console.log("\n\x1b[32m✓ API reference synced.\x1b[0m Review the diff and commit it.\n");
