#!/usr/bin/env node
/**
 * Regenerate the "what pairs with what" table on `docs/reference/compatibility.md`.
 *
 *     pnpm sync-compatibility
 *     pnpm sync-compatibility --expect eigen_flutter@0.3.0
 *
 * The table used to be hand-maintained, and it encoded a lockstep the page's
 * own prose denies. Three of its four columns are one number: the engine
 * stamps its release version into the spec, and `eigen_api` is published from
 * that same release, so the only column carrying independent information is
 * the Flutter shell, and the authority for that is pub.dev.
 *
 * A caret cannot express it either. `eigen_flutter` records which engines it
 * speaks through its OWN `eigen_api` constraint, so nothing stops 0.2.0 and
 * 0.4.0 from both speaking the 0.2.x wire while 0.3.0 speaks 0.3.x. Writing
 * `^0.2.0` in the shell column asserts a contiguity that is not real. Listing
 * the versions states what is actually true, and the generated form does that
 * by construction.
 *
 * ── What it reads ────────────────────────────────────────────────────────────
 *
 *   api/openapi.json      the line these docs describe. Committed here, kept
 *                         current by sync-api.yml, and already the authority
 *                         for `check-docs-version`.
 *   pub.dev / eigen_api   which engine lines ever shipped a wire client. This
 *                         is what keeps historical rows in the table without
 *                         anyone preserving them by hand.
 *   pub.dev / eigen_flutter  every published shell and the `eigen_api`
 *                         constraint it declares, which is the pairing itself.
 *
 * No sibling checkout, no engine build: everything comes from one committed
 * file and two registry reads, so this runs in seconds and works from a clean
 * clone.
 *
 * ── Retracted versions ───────────────────────────────────────────────────────
 *
 * Skipped. pub.dev has no delete, so retraction is how a bad version is
 * withdrawn: it stays downloadable and anything already pinning it in a
 * `pubspec.lock` keeps resolving, but the solver will not newly select it.
 * That is exactly the question this table answers, "if I resolve today, what
 * do I get", so a retracted shell is not a pairing to advertise.
 *
 * Retraction is only possible within seven days of publishing, so it can only
 * ever affect the newest rows; older ones are settled for good.
 *
 * ── Deliberately not a check ─────────────────────────────────────────────────
 *
 * There is no `--check` mode and no CI assertion that the committed table is
 * current, because its input is a registry that moves on its own. Such a check
 * would turn every unrelated pull request red the moment someone published a
 * shell, which is the failure mode eigen-server's scaffold gate already has and
 * does not need a second instance of. Staleness here is corrected by
 * regenerating, not by blocking.
 *
 * For the same reason the output carries no timestamp: `sync-compatibility.yml`
 * decides whether to open a pull request by diffing, and a clock in the output
 * would make every run look like a change.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const specPath = join(siteDir, "api", "openapi.json");
const pagePath = join(siteDir, "docs", "reference", "compatibility.md");

// MDX comments, not HTML ones. Docusaurus v3 defaults `markdown.format` to
// `mdx` for `.md` as well as `.mdx`, and MDX has no HTML comment syntax, so a
// `<!-- -->` here fails the build with "Unexpected character `!` before name".
const BEGIN = "{/* generated:compatibility-table, rewritten by scripts/sync-compatibility.mjs; do not edit between these markers */}";
const END = "{/* /generated:compatibility-table */}";

// pub.dev asks clients to identify themselves, and an unattributed script
// hammering the API is the kind of thing that gets a User-Agent blocked.
const USER_AGENT = "eigen-platform-sync-compatibility (+https://github.com/eigeninteractive/eigen-platform)";

/**
 * The compatibility line a caret protects: the minor while pre-1.0, the major
 * after. `^0.2.0` resolves to `>=0.2.0 <0.3.0`, so pre-1.0 the MINOR is the
 * breaking axis: the same rule `check-docs-version` and eigen-server's
 * scaffold gate apply, and the one thing every version number here agrees on.
 */
const lineOf = (version) => {
  const parsed = /^\D*(\d+)\.(\d+)\./.exec(version);
  if (!parsed) return undefined;
  const [, major, minor] = parsed;
  return major === "0" ? `0.${minor}` : major;
};

/** Newest line first. Compares numerically so `0.10` sorts above `0.9`. */
const compareLines = (a, b) => {
  const parts = (line) => line.split(".").map(Number);
  const [aMajor, aMinor = 0] = parts(a);
  const [bMajor, bMinor = 0] = parts(b);
  return bMajor - aMajor || bMinor - aMinor;
};

/** Newest version first, by major/minor/patch. Prereleases are filtered out before this. */
const compareVersions = (a, b) => {
  const parts = (v) => v.split(".").map(Number);
  const left = parts(a);
  const right = parts(b);
  return right[0] - left[0] || right[1] - left[1] || right[2] - left[2];
};

const fetchPackage = async (name) => {
  const url = `https://pub.dev/api/packages/${name}`;
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": USER_AGENT } });

  // A package that has never been published is a legitimate state: a brand new
  // wire line has no `eigen_api` until the engine's tag job lands, so 404 is
  // "nothing yet", not a failure. Anything else is a real problem and should
  // stop the run rather than silently produce a table missing a column.
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`${url} responded ${response.status} ${response.statusText}`);

  const { versions = [] } = await response.json();
  return versions.filter((entry) => entry.retracted !== true && !entry.version.includes("-"));
};

/**
 * pub.dev serves a published version from its API a moment after the publish
 * call returns. This script is triggered by that publish, so without waiting it
 * would regenerate from the state just before it and write an unchanged table,
 * producing no pull request and no error, which is the worst of both.
 */
const awaitVersion = async (name, version) => {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    const versions = await fetchPackage(name);
    if (versions.some((entry) => entry.version === version)) return versions;
    console.log(`  ${name} ${version} is not on pub.dev yet, retrying (${attempt}/10)`);
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
  throw new Error(`${name} ${version} never appeared on pub.dev. If it was retracted immediately after publishing, rerun this workflow without --expect.`);
};

const expected = (() => {
  const index = process.argv.indexOf("--expect");
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  const parsed = /^([a-z_][a-z0-9_]*)@(.+)$/.exec(value ?? "");
  if (!parsed) throw new Error(`--expect wants <package>@<version>, got "${value ?? ""}"`);
  return { name: parsed[1], version: parsed[2] };
})();

const { version: engineVersion } = JSON.parse(readFileSync(specPath, "utf8")).info;
const currentLine = lineOf(engineVersion);
if (!currentLine) throw new Error(`api/openapi.json carries a version this script cannot read: "${engineVersion}"`);

console.log(`Engine line from api/openapi.json: ${currentLine}.x (${engineVersion})`);

const shells = expected?.name === "eigen_flutter" ? await awaitVersion("eigen_flutter", expected.version) : await fetchPackage("eigen_flutter");
const wireClients = expected?.name === "eigen_api" ? await awaitVersion("eigen_api", expected.version) : await fetchPackage("eigen_api");

/** engine line → the shell versions declaring they speak it, newest first. */
const shellsByLine = new Map();
for (const entry of shells) {
  const constraint = entry.pubspec?.dependencies?.eigen_api;
  if (typeof constraint !== "string") continue;
  const line = lineOf(constraint);
  if (!line) continue;
  shellsByLine.set(line, [...(shellsByLine.get(line) ?? []), entry.version]);
}
for (const versions of shellsByLine.values()) versions.sort(compareVersions);

// Every line that ever shipped a wire client, plus the one these docs describe
// which may have no `eigen_api` yet, in the window between the engine's npm
// publish and its pub.dev tag job.
const lines = [...new Set([currentLine, ...wireClients.map((entry) => lineOf(entry.version)).filter(Boolean)])].sort(compareLines);

const row = (line) => {
  const label = line === currentLine ? `**${line}.x** *(this version)*` : `${line}.x`;
  const paired = shellsByLine.get(line) ?? [];
  const shell = paired.length > 0 ? paired.map((version) => `\`${version}\``).join(", ") : "*none yet*";
  return `| ${label} | \`^${line}.0\` | \`^${line}.0\` | ${shell} |`;
};

const table = [BEGIN, "", "| Docs | Engine (`@eigeninteractive/*`) | Wire client (`eigen_api`) | Flutter shell (`eigen_flutter`) |", "| --- | --- | --- | --- |", ...lines.map(row), "", END].join("\n");

const page = readFileSync(pagePath, "utf8");
const begin = page.indexOf(BEGIN);
const end = page.indexOf(END);
if (begin === -1 || end === -1) {
  throw new Error(`docs/reference/compatibility.md is missing the ${BEGIN} / ${END} markers this script writes between. Restore them before running it.`);
}

const updated = `${page.slice(0, begin)}${table}${page.slice(end + END.length)}`;
writeFileSync(pagePath, updated);

for (const line of lines) console.log(`  ${line}.x → eigen_flutter ${(shellsByLine.get(line) ?? []).join(", ") || "(none)"}`);
console.log(updated === page ? "\n✓ Table already current." : "\n✓ Table rewritten.");
