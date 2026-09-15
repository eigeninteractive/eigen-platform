#!/usr/bin/env node

// Refuses to publish a scaffolder whose floors name nothing on pub.dev.
//
// ── What this is for, and what it is not ─────────────────────────────────────
//
// `scripts/scaffold-e2e.mjs` asks whether the floors are CURRENT -- whether
// something published has overtaken them. It answers that by compiling, and it
// resolves the Dart half through `pubspec_overrides.yaml` pointing at this
// checkout, which is deliberate: it lets a floor name the version the same
// commit is creating, so `version-dart-package.yml` can raise floors before the
// tags publish and the repository never disagrees with itself.
//
// The cost of that is the question the gate stops asking: whether a user, who
// has no overrides and resolves from pub.dev for real, can install what the
// scaffolder emits. Between the release commit and the pub.dev publish the
// answer is no. That window is safe only because of an ORDERING -- the Dart
// tags publish off green main, while `create-eigen-game` publishes through a
// Changesets pull request that merges later still -- and an ordering that is
// merely very likely is not a thing to publish on top of.
//
// So this runs in `release.yml` immediately before the npm publish, and asks
// the user's question at the only moment the answer has to be yes.
//
// It waits rather than failing on the first miss. It runs minutes after the
// pub.dev publish it depends on, and pub.dev's package API lags its own
// uploads; the `Ensure eigen_api tag` step next door already learned this about
// npm the expensive way, three releases running.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FLOORS } from "./set-pins.mjs";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Every stable, still-selectable version of a package. */
const published = async (name) => {
  const url = `https://pub.dev/api/packages/${name}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} responded ${response.status} ${response.statusText}`);
  const { versions = [] } = await response.json();
  // Retracted versions stay downloadable for anyone already locked to one, but
  // a solver will not newly select them, and a new project is all this is about.
  return versions.filter((entry) => entry.retracted !== true && !entry.version.includes("-")).map((entry) => entry.version);
};

/**
 * Whether `version` falls inside a pub caret range.
 *
 * Pub's caret is not npm's below 1.0: `^0.0.3` means `>=0.0.3 <0.1.0` here,
 * where npm would stop at `0.0.4`. The upper bound is always the next version
 * that pub considers breaking, which pre-1.0 is the next minor.
 */
export function satisfies(version, floor) {
  const exact = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  const lower = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(floor);
  if (!exact || !lower) return false;

  const [major, minor, patch] = exact.slice(1, 4).map(Number);
  const [floorMajor, floorMinor, floorPatch] = lower.slice(1, 4).map(Number);

  const atLeast = major !== floorMajor ? major > floorMajor : minor !== floorMinor ? minor > floorMinor : patch >= floorPatch;
  const below = floorMajor > 0 ? major === floorMajor : major === 0 && minor === floorMinor;

  return atLeast && below;
}

/** The floors the scaffolder is about to ship, read where it states them. */
export function emittedFloors(source) {
  return Object.entries(FLOORS).map(([name, constant]) => {
    const floor = new RegExp(`const ${constant} = "(\\^\\d+\\.\\d+\\.\\d+)"`).exec(source)?.[1];
    if (!floor) throw new Error(`could not read ${constant} out of src/index.ts, so there is no floor to check`);
    return { name, floor };
  });
}

async function main() {
  const floors = emittedFloors(readFileSync(resolve(packageRoot, "src/index.ts"), "utf8"));
  const attempts = 12;
  let missing = [];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    missing = [];
    for (const { name, floor } of floors) {
      const available = await published(name);
      if (!available.some((version) => satisfies(version, floor))) {
        missing.push(`${name} ${floor} matches none of the ${available.length} versions on pub.dev`);
      }
    }

    if (missing.length === 0) {
      for (const { name, floor } of floors) console.log(`${name} ${floor} resolves.`);
      return;
    }

    if (attempt < attempts) {
      console.log(`::notice::pub.dev has not surfaced every floor yet (attempt ${attempt}/${attempts}): ${missing.join("; ")}`);
      await new Promise((done) => setTimeout(done, 25_000));
    }
  }

  console.error(`::error::create-eigen-game would publish floors nobody can install: ${missing.join("; ")}. The Dart release that raised them has not reached pub.dev. Wait for \`publish-dart.yml\` to finish and re-run this job; if those tags never published, recover that release before publishing the scaffolder.`);
  process.exitCode = 1;
}

// Only when run, so the test can import the pieces above without reaching the
// network or exiting the process.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  await main();
}
