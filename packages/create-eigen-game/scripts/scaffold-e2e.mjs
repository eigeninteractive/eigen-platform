#!/usr/bin/env node

// Scaffolds a real project and compiles both halves of it.
//
// This is the only thing that checks the Dart templates at all. `pnpm -r
// typecheck` compiles `templates/worker` against the workspace engine, but
// nothing anywhere compiled `templates/app-overlay` — the files that import
// `package:eigen_flutter/eigen_flutter.dart` — so the pinned `eigen_flutter`
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
// the check the more useful one — it compiles the templates against the engine
// about to ship rather than the engine that shipped last.
//
// `eigen_flutter` is deliberately NOT overridden. It lives in another
// repository and nothing here can substitute for it, which is exactly why the
// pinned range needs a real resolution against pub.dev to mean anything.

import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { scaffoldGame } from "../dist/index.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(packageRoot, "../..");

const ENGINE_PACKAGES = ["rules", "kernel", "server", "testkit"];

const shell = (command, args, cwd) => {
  console.log(`\n$ ${command} ${args.join(" ")}   (${cwd})`);
  execFileSync(command, args, { cwd, stdio: "inherit" });
};

/**
 * pnpm reads `overrides` from `pnpm-workspace.yaml` in a single-package project
 * too, and overrides apply transitively — which is what makes this work at all:
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

// ── The two halves must speak the same wire ──────────────────────────────────
//
// `flutter analyze` below proves the templates match the shell's DART API. It
// says nothing about the wire: `eigen_flutter` records which engines it speaks
// through its own `eigen_api` constraint, and a shell one line behind can
// compile perfectly against templates that barely touch what changed. The
// mismatch would surface as a decode failure against a running server, long
// after the scaffold.
//
// So this asserts the resolution rather than predicting it — which is what the
// pub.dev lookup this pin replaced was reaching for, and could not do, because
// it ran before any solver had spoken.
const emittedEngine = JSON.parse(readFileSync(resolve(serverRoot, "package.json"), "utf8")).dependencies["@eigeninteractive/server"];
const lock = readFileSync(resolve(appRoot, "pubspec.lock"), "utf8");
const resolvedShell = lockedVersion(lock, "eigen_flutter");
const resolvedApi = lockedVersion(lock, "eigen_api");

console.log(`\nengine ${emittedEngine} · eigen_flutter ${resolvedShell} · eigen_api ${resolvedApi}`);

if (line(emittedEngine) !== line(resolvedApi)) {
  throw new Error(
    `the scaffolded halves speak different engines: the server takes ${emittedEngine} but eigen_flutter ${resolvedShell} resolved eigen_api ${resolvedApi} (the ${line(resolvedApi)}.x wire). ` +
      `Raise flutterClientVersion in packages/create-eigen-game/src/index.ts to a shell that constrains eigen_api ^${line(emittedEngine)}.0, and update the matrix at https://eigeninteractive.com/docs/reference/compatibility.`,
  );
}

// The server half. `contract` already ran during bootstrap — this is the part a
// game author would run next, and it is what proves the emitted engine range
// and the template sources agree.
shell("pnpm", ["run", "typecheck"], serverRoot);
shell("pnpm", ["run", "test"], serverRoot);

// The app half, against the real published `eigen_flutter`. `analyze` is the
// check that matters: it resolves every import in the rendered templates and
// every symbol they call, which is precisely the coupling the pin asserts.
shell("flutter", ["analyze"], appRoot);
shell("flutter", ["test"], appRoot);

console.log(`\nScaffolded, built and tested ${root}`);
