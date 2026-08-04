import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_PACKAGE, engineRange } from "./engine-range.js";

export type PackageManager = "npm" | "pnpm";

export interface ScaffoldOptions {
  directory: string;
  org?: string;
  packageManager?: PackageManager;
  /**
   * Run Flutter, package installation, and contract/payload generation.
   * Kept as a programmatic test seam; the public CLI always bootstraps both
   * halves of the combined project.
   */
  bootstrap?: boolean;
  /**
   * Runs the bootstrap subprocesses. A seam: the tests substitute a recorder,
   * and `scripts/scaffold-e2e.mjs` wraps it to point the generated server at
   * this workspace's engine rather than npm's copy.
   */
  run?: (command: string, args: string[], cwd: string) => void;
}

export interface ScaffoldResult {
  root: string;
  name: string;
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templatesRoot = resolve(packageRoot, "templates");

/**
 * The engine range emitted into a scaffolded project's package.json.
 *
 * Read from this package's `@eigeninteractive/server` devDependency rather than
 * from its own version — see `engine-range.ts` for why that is the version the
 * templates are known to compile against, and what it replaced.
 */
const engineVersion = engineRange((JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as { devDependencies?: Record<string, string> }).devDependencies?.[ENGINE_PACKAGE], () => {
  // Only reached in this workspace, where the manifest still says
  // `workspace:*`. A published tarball has no sibling here and never asks.
  const sibling = resolve(packageRoot, "../server/package.json");
  return existsSync(sibling) ? (JSON.parse(readFileSync(sibling, "utf8")) as { version: string }).version : undefined;
});

/**
 * The Flutter client range installed into the app half.
 *
 * A stated version, not a derived or resolved one. The Dart templates import
 * `package:eigen_flutter/eigen_flutter.dart` and
 * `package:eigen_flutter/testing/twin_fixtures.dart` and are written against a
 * specific Dart API — and `eigen_flutter` lives in another repository, versioned
 * independently, so nothing in this repository can compute which release that
 * is. Only compiling a scaffolded app establishes it, which is what the
 * `scaffold` job in checks.yml does on every change.
 *
 * This briefly resolved from pub.dev instead: "the newest `eigen_flutter` whose
 * own `eigen_api` constraint targets the engine line being scaffolded". That
 * predicate is wrong. The `eigen_api` constraint describes the WIRE the shell
 * speaks, not the Dart API these templates call, and the two move
 * independently — a future `eigen_flutter` may legitimately keep `eigen_api:
 * ^0.2.0` while renaming everything the templates touch. It would have been
 * selected, and the generated app would not compile.
 *
 * A caret RANGE rather than an exact version, so it still improves without a
 * republish: `flutter pub add eigen_flutter@^0.2.0` already picks the newest
 * 0.2.x at scaffold time, which is the part the pub.dev lookup was duplicating.
 * What it deliberately cannot do is cross to 0.3.x — the one move that needs a
 * human to confirm the templates still compile.
 *
 * Staleness is therefore a failing check rather than a broken scaffold: this is
 * only ever a release behind, never wrong.
 */
const flutterClientVersion = "^0.2.0";

const gameSlug = (value: string): string => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error("destination directory name must be a lowercase kebab-case slug, for example my-game");
  }
  return value;
};

const dartName = (value: string): string => value.replaceAll("-", "_");

const title = (value: string): string =>
  value
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");

const identifier = (value: string): string => {
  const pascal = value
    .split("-")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join("");
  return /^[0-9]/.test(pascal) ? `Game${pascal}` : pascal;
};

export function detectPackageManager(userAgent = process.env.npm_config_user_agent): PackageManager | undefined {
  if (userAgent?.startsWith("pnpm/")) return "pnpm";
  if (userAgent?.startsWith("npm/")) return "npm";
  return undefined;
}

function render(contents: string, name: string, manager: PackageManager): string {
  const replacements: ReadonlyArray<readonly [string, string]> = [
    ["@game/example-game-server", `@game/${name}-server`],
    ["{{PACKAGE_MANAGER}}", manager],
    ["{{ENGINE_VERSION}}", engineVersion],
    ["ExampleGame", identifier(name)],
    ["Example Game", title(name)],
    ["example_game", dartName(name)],
    ["example-game", name],
  ];
  return replacements.reduce((result, [from, to]) => result.replaceAll(from, to), contents);
}

function renderTree(source: string, destination: string, name: string, manager: PackageManager): void {
  cpSync(source, destination, { recursive: true });
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) {
        writeFileSync(path, render(readFileSync(path, "utf8"), name, manager));
        // Template-only source must not be claimed by language servers before
        // it has an enclosing generated package. Restore the real extension
        // only in the rendered project.
        if (entry.name.endsWith(".template")) {
          renameSync(path, path.slice(0, -".template".length));
        }
      }
    }
  };
  visit(destination);

  // npm deliberately excludes files named `.gitignore` from package
  // tarballs. Their packaged twins live outside the C3 template so a direct
  // Git-based C3 render does not inherit a scaffolder-only helper file.
  const packagedGitignore = resolve(templatesRoot, "scaffold", `${basename(source)}.gitignore`);
  if (existsSync(packagedGitignore)) {
    writeFileSync(resolve(destination, ".gitignore"), render(readFileSync(packagedGitignore, "utf8"), name, manager));
  }
}

function packageCommand(manager: PackageManager, operation: "install" | "contract"): [string, string[]] {
  if (operation === "install") return [manager, ["install"]];
  return [manager, ["run", "contract"]];
}

const androidDesugaring = `// flutter_local_notifications requires desugaring in the application module.
// A library plugin cannot enable this compiler setting transitively.
android {
    compileOptions {
        isCoreLibraryDesugaringEnabled = true
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}`;

function enableAndroidCoreLibraryDesugaring(appRoot: string): void {
  const gradlePath = resolve(appRoot, "android/app/build.gradle.kts");
  const gradle = readFileSync(gradlePath, "utf8");
  if (!gradle.includes('id("com.android.application")')) {
    throw new Error(`Flutter created an unexpected Android application build file: ${gradlePath}`);
  }
  const settingExists = gradle.includes("isCoreLibraryDesugaringEnabled");
  const dependencyExists = gradle.includes("coreLibraryDesugaring(");
  if (settingExists && dependencyExists) return;
  if (settingExists || dependencyExists) {
    throw new Error(`Flutter created an incomplete Android core library desugaring configuration: ${gradlePath}`);
  }
  appendFileSync(gradlePath, `${gradle.endsWith("\n") ? "\n" : "\n\n"}${androidDesugaring}\n`);
}

export function scaffoldGame(options: ScaffoldOptions): ScaffoldResult {
  const root = resolve(options.directory);
  const name = gameSlug(basename(root));
  const manager = options.packageManager ?? detectPackageManager() ?? "pnpm";
  const org = options.org?.trim() || "com.example";
  const bootstrap = options.bootstrap ?? true;
  const run = options.run ?? ((command, args, cwd) => execFileSync(command, args, { cwd, stdio: "inherit" }));

  if (existsSync(root)) throw new Error(`target already exists: ${root}`);

  mkdirSync(dirname(root), { recursive: true });

  // Build beside the destination and publish it with one rename. Failed
  // subprocesses never leave a half-scaffolded project at the requested path.
  const stagingRoot = mkdtempSync(resolve(dirname(root), `.${basename(root)}-`));
  try {
    const serverRoot = resolve(stagingRoot, "server");
    const appRoot = resolve(stagingRoot, "app");

    renderTree(resolve(templatesRoot, "worker"), serverRoot, name, manager);
    renderTree(resolve(templatesRoot, "project"), stagingRoot, name, manager);

    if (bootstrap) {
      run("flutter", ["create", "--empty", "--platforms", "android,web", "--project-name", dartName(name), "--org", org, appRoot], stagingRoot);
      enableAndroidCoreLibraryDesugaring(appRoot);
    } else {
      mkdirSync(appRoot, { recursive: true });
    }
    renderTree(resolve(templatesRoot, "app-overlay"), appRoot, name, manager);

    if (bootstrap) {
      run("flutter", ["pub", "add", `eigen_flutter@${flutterClientVersion}`, "firebase_core@^4.9.0", "firebase_messaging@^16.2.2"], appRoot);
      const [install, installArgs] = packageCommand(manager, "install");
      run(install, installArgs, serverRoot);
      const [contract, contractArgs] = packageCommand(manager, "contract");
      run(contract, contractArgs, serverRoot);
      run("dart", ["run", "eigen_flutter:generate_payloads", "--contract", "../server/game-contract.json", "--output", "lib/game/generated/payloads.dart", "--fixtures-output", "test/fixtures"], appRoot);
    }

    renameSync(stagingRoot, root);
    return { root, name };
  } catch (error) {
    rmSync(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}
