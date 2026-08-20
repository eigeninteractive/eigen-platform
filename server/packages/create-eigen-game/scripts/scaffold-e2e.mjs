#!/usr/bin/env node

// Scaffolds a real project and compiles both halves of it.
//
// This is the only thing that checks the Dart templates at all. `pnpm -r
// typecheck` compiles `templates/worker` against the workspace engine, but
// nothing anywhere compiled `templates/app-overlay`, the files that import
// `package:eigen_flutter/eigen_flutter.dart`, so the pinned `eigen_flutter`
// range was an assertion no build ever tested. eigen-flutter's own `example/`
// is a different tree and cannot stand in for it.
//
// It is also the only check that `npm create eigen-game` produces something
// that builds, rather than something whose pieces each build separately.
//
// ── Which engine this resolves ────────────────────────────────────────────────
//
// The generated server declares the engine by RANGE, from npm. That is the
// wrong thing to resolve here, and fatally so at release time: when the version
// pull request raises the engine to a new line, the scaffolder emits that line
// before it exists on npm, and the install would fail on the very commit that
// publishes it. The gate would deadlock every line-crossing release.
//
// So the four engine packages are overridden to this workspace. That also makes
// the check the more useful one: it compiles the templates against the engine
// about to ship rather than the engine that shipped last.
//
// The generated app first resolves `eigen_flutter` from pub.dev so the emitted
// range and released compatibility line remain tested. After that assertion,
// the build is switched to this platform checkout's Flutter and generated Dart
// packages. That proves the server, client, templates, Android app, and web app
// from one platform commit work together before any of them is published.

import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scaffoldGame } from "../dist/index.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(packageRoot, "../..");
const platformRoot = resolve(workspaceRoot, "..");

const ENGINE_PACKAGES = ["rules", "kernel", "server", "testkit"];
const buildTarget = process.argv[2] ?? "all";

if (!["all", "android", "web"].includes(buildTarget)) {
  throw new Error(`unknown scaffold build target ${JSON.stringify(buildTarget)}; expected all, android, or web`);
}

const shell = (command, args, cwd) => {
  console.log(`\n$ ${command} ${args.join(" ")}   (${cwd})`);
  execFileSync(command, args, { cwd, stdio: "inherit" });
};

/**
 * pnpm reads `overrides` from `pnpm-workspace.yaml` in a single-package project
 * too, and overrides apply transitively, which is what makes this work at all:
 * `@eigeninteractive/server` depends on `kernel` and peer-depends on `rules`,
 * and those would otherwise be fetched from npm at the very version that does
 * not exist yet.
 */
const overrides = () => ["", "overrides:", ...ENGINE_PACKAGES.map((name) => `  "@eigeninteractive/${name}": "link:${resolve(workspaceRoot, "packages", name)}"`), ""].join("\n");

const target = resolve(mkdtempSync(resolve(tmpdir(), "eigen-scaffold-e2e-")), "e2e-game");

const { root } = scaffoldGame({
  directory: target,
  packageManager: "pnpm",
  // The seam exists for the tests; here it is the hook that lands the overrides
  // after the templates are rendered and before anything is installed.
  run: (command, args, cwd) => {
    // Appended, not written: the template ships its own `pnpm-workspace.yaml`
    // carrying `allowBuilds`, and replacing it would silently drop that and
    // turn this into a test of a project no user has.
    if (args[0] === "install") appendFileSync(resolve(cwd, "pnpm-workspace.yaml"), overrides());
    // eigen_codegen is a package from this same platform commit. Its first
    // release cannot exist on pub.dev until this source has landed, and every
    // later version has the same release-window problem as the npm packages
    // above. Put the local override in place before `pub add` asks the solver
    // for it; the emitted caret range is still asserted by scaffold unit tests.
    if (command === "flutter" && args.includes(`dev:eigen_codegen@^0.1.0`)) {
      writeFileSync(resolve(cwd, "pubspec_overrides.yaml"), ["dependency_overrides:", "  eigen_codegen:", `    path: ${JSON.stringify(resolve(platformRoot, "flutter/packages/eigen_codegen"))}`, ""].join("\n"));
    }
    shell(command, args, cwd);
  },
});

const serverRoot = resolve(root, "server");
const appRoot = resolve(root, "app");

/** The compatibility line a caret protects: the minor pre-1.0, the major after. */
const line = (version) => {
  const [major, minor] = version.replace(/^\D+/, "").split(".");
  return major === "0" ? `0.${minor}` : major;
};

/** The version `pub` actually settled on, read from the generated lockfile. */
const lockedVersion = (lock, name) => {
  const lines = lock.split("\n");
  const start = lines.indexOf(`  ${name}:`);
  if (start === -1) throw new Error(`${name} is not in the generated pubspec.lock`);
  for (let index = start + 1; index < lines.length && lines[index].startsWith("    "); index += 1) {
    const version = /^ {4}version: "?([^"\s]+)"?$/.exec(lines[index]);
    if (version) return version[1];
  }
  throw new Error(`no version recorded for ${name} in the generated pubspec.lock`);
};

/** Published releases that declare they speak a given engine line. */
const shellsSpeaking = async (engineLine) => {
  const url = "https://pub.dev/api/packages/eigen_flutter";
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} responded ${response.status} ${response.statusText}`);
  const { versions = [] } = await response.json();
  return versions
    .filter((entry) => entry.retracted !== true && !entry.version.includes("-"))
    .filter((entry) => {
      const constraint = entry.pubspec?.dependencies?.eigen_api;
      return typeof constraint === "string" && line(constraint) === engineLine;
    })
    .map((entry) => entry.version);
};

// ── The two halves must speak the same wire ──────────────────────────────────
//
// `flutter analyze` below proves the templates match the shell's DART API. It
// says nothing about the wire: `eigen_flutter` records which engines it speaks
// through its own `eigen_api` constraint, and a shell one line behind can
// compile perfectly against templates that barely touch what changed. The
// mismatch would surface as a decode failure against a running server, long
// after the scaffold.
//
// So this asserts what the solver decided rather than predicting it.
//
// ── Why "mismatched" is not automatically "wrong" ────────────────────────────
//
// The shell CANNOT match a brand-new engine line, and that is structural rather
// than an oversight. `eigen_api` is published with the engine, and no
// `eigen_flutter` of any version number can constrain `^0.3.0` until
// `eigen_api 0.3.0` exists on pub.dev, which happens when the engine's own
// release merges.
//
// An unconditional assertion therefore fails on the version pull request that
// crosses the line, and as a required check it would block the very merge that
// publishes the `eigen_api` the shell is waiting for. The gate would deny
// entry to the only thing that could satisfy it.
//
// Asking pub.dev what exists separates the two states the raw comparison
// conflates:
//
//   no shell speaks this line yet   → mid-crossing, expected, say so and pass
//   one does, and the pin misses it → the pin is stale, and that is a defect
//
// The second is also the signal to raise the pin: this job turns red the moment
// a compatible shell ships, which is exactly when the scaffolder should be
// released. Nothing has to notice on its own.
//
// This queries the registry the deleted resolver queried, for the opposite
// purpose. Choosing a shell by its `eigen_api` constraint is wrong, because the
// constraint cannot see the Dart API the templates call. Checking whether a
// shell for this line exists at all asks nothing about the Dart API, and the
// build above already answered that question.
const emittedEngine = JSON.parse(readFileSync(resolve(serverRoot, "package.json"), "utf8")).dependencies["@eigeninteractive/server"];
const lock = readFileSync(resolve(appRoot, "pubspec.lock"), "utf8");
const resolvedShell = lockedVersion(lock, "eigen_flutter");
const resolvedApi = lockedVersion(lock, "eigen_api");
const engineLine = line(emittedEngine);

console.log(`\nengine ${emittedEngine} · eigen_flutter ${resolvedShell} · eigen_api ${resolvedApi}`);

const speakers = await shellsSpeaking(engineLine);

if (speakers.length === 0) {
  console.log(
    `::notice::No published eigen_flutter constrains eigen_api ^${engineLine}.0 yet, so there is no wire pairing to check. ` + `This is the expected state between an engine line crossing and the shell release that follows it: the shell cannot be built for ${engineLine}.x until eigen_api ${engineLine}.0 is on pub.dev.`,
  );
} else if (line(resolvedApi) !== engineLine) {
  throw new Error(
    `the scaffolded halves speak different engines: the server takes ${emittedEngine} but eigen_flutter ${resolvedShell} resolved eigen_api ${resolvedApi} (the ${line(resolvedApi)}.x wire). ` +
      `eigen_flutter ${speakers.join(", ")} already speaks ${engineLine}.x, so this is a stale pin rather than a shell that has not caught up. ` +
      `Raise flutterClientVersion in packages/create-eigen-game/src/index.ts, and update the matrix at https://eigeninteractive.com/docs/reference/compatibility.`,
  );
}

// The published resolution above checks what a newly scaffolded project gets
// today. The rest of this gate must check what this monorepo is about to ship.
// Root dependency overrides apply transitively, so both the Flutter shell and
// the generated Dart transport are pinned to the same checkout.
writeFileSync(
  resolve(appRoot, "pubspec_overrides.yaml"),
  ["dependency_overrides:", "  eigen_api:", `    path: ${JSON.stringify(resolve(workspaceRoot, "clients/dart"))}`, "  eigen_codegen:", `    path: ${JSON.stringify(resolve(platformRoot, "flutter/packages/eigen_codegen"))}`, "  eigen_flutter:", `    path: ${JSON.stringify(resolve(platformRoot, "flutter"))}`, ""].join(
    "\n",
  ),
);
shell("flutter", ["pub", "get"], appRoot);

// The server half. `contract` already ran during bootstrap; this is the part a
// game author would run next, and it is what proves the emitted engine range
// and the template sources agree.
shell("pnpm", ["run", "typecheck"], serverRoot);
shell("pnpm", ["run", "test"], serverRoot);

// The app half, against this platform commit. Analysis and tests cover the Dart
// contract; release builds also prove both supported platform integrations
// compile without secrets.
shell("flutter", ["analyze"], appRoot);
shell("flutter", ["test"], appRoot);
if (buildTarget === "all" || buildTarget === "android") {
  shell("flutter", ["build", "apk", "--release", "--dart-define-from-file=app-config.json"], appRoot);
}
if (buildTarget === "all" || buildTarget === "web") {
  shell("flutter", ["build", "web", "--release", "--dart-define-from-file=app-config.json"], appRoot);
}

console.log(`\nScaffolded, built and tested ${buildTarget} at ${root}`);
