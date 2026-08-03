#!/usr/bin/env node
/**
 * Assert that the documentation version label still names the engine line these
 * pages describe.
 *
 *     pnpm check-docs-version
 *
 * The docs are versioned on the engine's release line, and the engine stamps
 * that line into the spec it emits — so `info.version` in the committed
 * `api/openapi.json` is the authority, and `versions.current.label` in
 * `docusaurus.config.ts` is the claim being checked against it.
 *
 * This exists because the two move through different pipelines. `sync-api.yml`
 * refreshes the spec and the generated reference automatically and auto-merges
 * the result; the label is hand-set. Without this check, the first engine
 * release to cross a line would land a 0.3.x reference under a site still
 * calling itself 0.2.x, unreviewed, and the only symptom would be a version
 * selector quietly lying.
 *
 * Failing here is the intended behaviour, not an obstacle: crossing a line is a
 * decision — freeze the old one or relabel in place — and the sync pull request
 * stalling on a red check is what puts that decision in front of a human.
 * CONTRIBUTING.md has the procedure for both answers.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const specPath = join(siteDir, "api", "openapi.json");
const configPath = join(siteDir, "docusaurus.config.ts");

const { version } = JSON.parse(readFileSync(specPath, "utf8")).info;

const parsed = /^(\d+)\.(\d+)\.\d+/.exec(version);
if (!parsed) {
  console.error(`✗ api/openapi.json carries a version this script cannot read: "${version}"`);
  process.exit(1);
}

// Pre-1.0 the breaking axis is the MINOR — `^0.2.0` resolves to `>=0.2.0
// <0.3.0` — so a 0.x line is "0.<minor>.x". From 1.0.0 on it is the major.
const [, major, minor] = parsed;
const line = major === "0" ? `0.${minor}.x` : `${major}.x`;

// Read the label out of the config source rather than importing it: the config
// is TypeScript, and loading it would mean pulling in the whole Docusaurus
// toolchain to read one string. A miss is a hard failure below, so a config
// restructure breaks this loudly instead of passing vacuously.
const labelMatch = /versions:\s*\{\s*current:\s*\{[^}]*?label:\s*"([^"]+)"/.exec(readFileSync(configPath, "utf8"));
if (!labelMatch) {
  console.error("✗ Could not find `versions.current.label` in docusaurus.config.ts.");
  console.error("  The config moved. Update the pattern in scripts/check-docs-version.mjs.");
  process.exit(1);
}
const label = labelMatch[1];

if (label !== line) {
  console.error(`✗ The docs are labelled "${label}", but the engine spec they ship is ${version} (line ${line}).`);
  console.error("");
  console.error("  The engine crossed a release line. Choose one, in CONTRIBUTING.md → Documentation versions:");
  console.error(`    · freeze the old line:  pnpm docusaurus docs:version ${label}`);
  console.error(`    · or relabel in place:  versions.current.label = "${line}" in docusaurus.config.ts`);
  console.error("");
  console.error("  Freezing is the answer whenever a reader could still be running the old line.");
  process.exit(1);
}

console.log(`✓ Docs labelled "${label}", matching engine ${version}.`);
