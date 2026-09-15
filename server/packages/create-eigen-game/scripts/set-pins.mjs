#!/usr/bin/env node

// Raises the published Dart floors a scaffolded app installs, from the versions
// a release is about to create.
//
//     node scripts/set-pins.mjs eigen_flutter=0.12.0 eigen_shell=0.3.1
//
// ── Why this runs inside the release commit ──────────────────────────────────
//
// `src/index.ts` states four floors and derives none of them, for the reason
// written there: a published `eigen_flutter` records which WIRE it speaks, not
// whether its Dart API still matches the templates, so nothing can compute the
// floor from the registry. Only compiling a scaffolded app establishes it.
//
// That left them raised by hand, and always LATE -- a floor names a published
// version, so it could not move until the release published, and until someone
// raised it `scripts/scaffold-e2e.mjs` failed every pull request in the
// repository for a reason unrelated to the change in it.
//
// The lateness turns out to be avoidable. The gate resolves the Dart half
// through `pubspec_overrides.yaml` pointing at this checkout, so it compiles
// the templates against the source about to be released rather than against
// pub.dev, and a floor naming a version that has not published yet resolves
// exactly as well as one that has. So the floor can move in the same commit
// that creates the version it names, which is the only commit that knows the
// number without being told.
//
// `version-dart-package.yml` calls this with the versions melos just wrote. The
// pin is therefore already correct when the tags publish, and no window exists
// in which the repository disagrees with itself.
//
// What still has to be true at PUBLICATION is that pub.dev has these versions,
// since a user scaffolding from npm resolves for real with no overrides. That
// is `release.yml`'s gate, not this script's: the ordering makes it true
// (create-eigen-game publishes through Changesets, which merges after the tags)
// and the gate is what refuses to rely on the ordering.
//
// ── Not in `src/` ────────────────────────────────────────────────────────────
//
// Release tooling, not CLI behaviour. `src/` ships in the tarball, and a module
// no published code path imports would be dead weight in it. Its test is
// `.mjs` for the same reason `tsconfig.json` includes only `src` and `test`:
// this is plain JavaScript that vitest runs and `tsc` has no business
// compiling.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The floors this script owns: published package to the constant naming it. */
export const FLOORS = Object.freeze({
  eigen_flutter: "flutterClientVersion",
  eigen_shell: "flutterShellVersion",
  eigen_firebase: "firebaseAdapterVersion",
  eigen_codegen: "dartCodegenVersion",
});

/**
 * Released by the same workflow and deliberately not floors.
 *
 * `eigen_client` reaches a scaffolded app through `eigen_flutter` rather than
 * by name, and `eigen_api` is stamped from the engine and published on npm's
 * clock. Naming them here rather than ignoring unknown arguments keeps a typo
 * an error instead of a silent no-op.
 */
export const UNPINNED = Object.freeze(["eigen_api", "eigen_client"]);

const EXACT = /^(\d+)\.(\d+)\.(\d+)$/;

const parse = (value, what) => {
  const match = EXACT.exec(value);
  if (!match) throw new Error(`${what} must be an exact x.y.z version, got ${JSON.stringify(value)}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

const compare = (a, b) => {
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
};

/**
 * The floor `released` calls for, or `undefined` when the current one already
 * names it.
 *
 * Raises to the EXACT released version rather than to the bottom of its line.
 * `^0.4.0` and `^0.4.1` protect the same line, but only the second is true:
 * the templates were compiled against 0.4.1, and `^0.4.0` also resolves 0.4.0,
 * where whatever the release added does not exist. That distinction is not
 * hypothetical -- `flutterClientVersion` carries a note about the release where
 * exactly this bit.
 *
 * Never lowers. A floor above what a release is publishing means the two
 * disagree about what exists, and guessing which is right is how a scaffold
 * ends up pinned to nothing.
 */
export function nextFloor(current, released, name) {
  const floor = /^\^(\d+\.\d+\.\d+)$/.exec(current);
  if (!floor) throw new Error(`${name}'s floor must be a caret on an exact version, got ${JSON.stringify(current)}`);

  const order = compare(parse(released, `${name}'s released version`), parse(floor[1], `${name}'s floor`));
  if (order < 0) {
    throw new Error(`${name} ${released} is older than the floor ${current} the scaffolder already names, so this release would lower it; reconcile the two by hand`);
  }
  return order === 0 ? undefined : `^${released}`;
}

/** Replaces one floor constant, insisting it appears exactly once. */
export function rewriteConstant(source, constant, floor) {
  const pattern = new RegExp(`(const ${constant} = ")\\^\\d+\\.\\d+\\.\\d+(")`, "g");
  const found = source.match(pattern) ?? [];
  if (found.length !== 1) {
    throw new Error(`expected exactly one \`const ${constant} = "^x.y.z"\` to rewrite, found ${found.length}`);
  }
  return source.replace(pattern, `$1${floor}$2`);
}

/**
 * Replaces every `name@^x.y.z` in the unit test's expected `pub add` arguments.
 *
 * Counted rather than trusted. `scaffold-e2e.mjs` records why: a script that
 * scraped a version out of source once stopped matching, and did not fail --
 * it matched something else and reported the wrong string. A rewrite that
 * silently touches nothing would leave the test asserting the old floor and
 * the failure would surface as an unrelated red.
 */
export function rewriteExpectations(spec, name, floor, expected) {
  const pattern = new RegExp(`${name}@\\^\\d+\\.\\d+\\.\\d+`, "g");
  const found = spec.match(pattern) ?? [];
  if (found.length !== expected) {
    throw new Error(`expected ${expected} \`${name}@^x.y.z\` expectations to rewrite, found ${found.length}`);
  }
  return spec.replace(pattern, `${name}@${floor}`);
}

/** How many times each floor is asserted in `test/scaffold.spec.ts`. */
const EXPECTATIONS = Object.freeze({
  eigen_flutter: 1,
  eigen_shell: 1,
  eigen_firebase: 1,
  // Once in the standard scaffold's arguments, once where the contract step
  // asserts the generator is installed.
  eigen_codegen: 2,
});

/** Parses `name=version` arguments into the releases this should apply. */
export function releases(args) {
  const parsed = new Map();
  for (const argument of args) {
    const separator = argument.indexOf("=");
    if (separator < 1) throw new Error(`expected <package>=<version>, got ${JSON.stringify(argument)}`);
    const name = argument.slice(0, separator);
    const version = argument.slice(separator + 1);
    if (UNPINNED.includes(name)) continue;
    if (!(name in FLOORS)) {
      throw new Error(`${name} is not a package the scaffolder pins; it emits ${Object.keys(FLOORS).join(", ")}`);
    }
    parse(version, `${name}'s released version`);
    parsed.set(name, version);
  }
  return parsed;
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function main(args) {
  const sourcePath = resolve(packageRoot, "src/index.ts");
  const specPath = resolve(packageRoot, "test/scaffold.spec.ts");
  const changesetPath = resolve(packageRoot, "../../.changeset/scaffold-pins.md");

  let source = readFileSync(sourcePath, "utf8");
  let spec = readFileSync(specPath, "utf8");
  const raised = [];

  for (const [name, version] of releases(args)) {
    const constant = FLOORS[name];
    const current = new RegExp(`const ${constant} = "(\\^\\d+\\.\\d+\\.\\d+)"`).exec(source)?.[1];
    if (!current) throw new Error(`could not read the current ${constant} out of src/index.ts`);

    const floor = nextFloor(current, version, name);
    if (!floor) continue;

    source = rewriteConstant(source, constant, floor);
    spec = rewriteExpectations(spec, name, floor, EXPECTATIONS[name]);
    raised.push({ name, from: current, to: floor });
  }

  if (raised.length === 0) {
    console.log("Every scaffolder floor already names the versions being released.");
    return;
  }

  writeFileSync(sourcePath, source);
  writeFileSync(specPath, spec);

  // A fixed filename, so re-running on a refreshed release branch replaces this
  // changeset rather than stacking a second one describing the same raise.
  writeFileSync(changesetPath, ["---", '"create-eigen-game": patch', "---", "", "Install the newly released Dart packages in a scaffolded app.", "", ...raised.map(({ name, to }) => `- \`${name}\` ${to}`), ""].join("\n"));

  for (const { name, from, to } of raised) {
    console.log(`::notice::scaffolder floor ${name} ${from} -> ${to}`);
  }
}

// Only when run, so the test can import the pieces above.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2));
}
