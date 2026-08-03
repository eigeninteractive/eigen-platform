import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  run?: (command: string, args: string[], cwd: string) => void;
  /**
   * Reads pub.dev to resolve the compatible `eigen_flutter` release. A test
   * seam, in the same spirit as `run` — nothing here should reach the network
   * in a unit test.
   */
  fetchJson?: FetchJson;
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
 * Derived from this package's OWN version, which is meaningful only because
 * `create-eigen-game` is a member of the `fixed` group in
 * .changeset/config.json: it carries the same version as
 * @eigeninteractive/rules, kernel, server and testkit. That makes the pin
 * incapable of drifting, because there is no second number anyone could forget
 * to bump — as opposed to a literal in the template, which silently keeps
 * scaffolding the previous engine after a release.
 *
 * It also leaves older scaffolders self-consistent rather than broken:
 * `create-eigen-game@0.1.0` emits `^0.1.0`, which still resolves. `npm create`
 * takes the latest by default, so this only matters to someone who pinned
 * deliberately — and they get a coherent pairing.
 */
const engineVersion = `^${(JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8")) as { version: string }).version}`;

/**
 * The Flutter client range installed into the app half, resolved from pub.dev
 * at scaffold time.
 *
 * It used to be a literal here, and a literal cannot be right for long. Only
 * publishing this package can correct one — and `create-eigen-game` is in the
 * `fixed` changesets group, so that means an engine-wide release for a change
 * the engine did not make. Every scaffolder already on npm also keeps emitting
 * whatever was baked into it, so the pairing rots in versions nobody can reach.
 *
 * A lookup has neither problem. `eigen_flutter` already states which engine it
 * speaks, through its own `eigen_api` constraint, and pub.dev serves every
 * version's pubspec — so the newest shell for this engine line is a fact to
 * read rather than one to remember. Old scaffolders keep working and improve.
 *
 * There is deliberately NO offline fallback. A stale pin that still resolves is
 * worse than a failed scaffold: it emits a project whose halves quietly
 * disagree, and that surfaces much later as a decode failure against a running
 * server. Bootstrapping already needs the network for `flutter pub add` and the
 * package install, so requiring it here adds no new dependency — only an
 * earlier and much clearer failure.
 */
const PUB_PACKAGE_API = "https://pub.dev/api/packages/eigen_flutter";

/** Only the fields this resolver reads. pub.dev returns considerably more. */
interface PubVersion {
  version: string;
  retracted?: boolean;
  pubspec?: { dependencies?: Record<string, unknown> };
}

export type FetchJson = (url: string) => Promise<unknown>;

/**
 * The compatibility line a version string belongs to. Pre-1.0 that is the minor
 * — `^0.2.0` resolves to `>=0.2.0 <0.3.0` — and from 1.0.0 on it is the major.
 *
 * Unanchored on purpose: it reads a bare version, a caret range, and the
 * `>=0.2.0 <0.3.0` form alike, taking the lower bound in the last case.
 */
const compatibilityLine = (value: string): string | undefined => {
  const parsed = /(\d+)\.(\d+)\.\d+/.exec(value);
  if (!parsed) return undefined;
  return parsed[1] === "0" ? `0.${parsed[2]}` : parsed[1];
};

const compareVersions = (left: string, right: string): number => {
  const parts = (value: string): number[] => (/(\d+)\.(\d+)\.(\d+)/.exec(value) ?? ["", "0", "0", "0"]).slice(1).map(Number);
  const [leftMajor, leftMinor, leftPatch] = parts(left);
  const [rightMajor, rightMinor, rightPatch] = parts(right);
  return leftMajor - rightMajor || leftMinor - rightMinor || leftPatch - rightPatch;
};

const fetchJsonOverHttps: FetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} responded ${response.status} ${response.statusText}`);
  return response.json();
};

/**
 * The newest published `eigen_flutter` whose own `eigen_api` constraint targets
 * the same engine line this scaffolder emits.
 *
 * Prereleases and retracted versions are skipped: a scaffolded project should
 * start on something a consumer would choose deliberately.
 */
async function resolveFlutterClientRange(engineRange: string, fetchJson: FetchJson): Promise<string> {
  const line = compatibilityLine(engineRange);
  if (!line) throw new Error(`cannot read a compatibility line from the engine range ${engineRange}`);

  let payload: unknown;
  try {
    payload = await fetchJson(PUB_PACKAGE_API);
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new Error(`could not reach pub.dev to find the eigen_flutter release for engine ${line}.x (${cause}). Scaffolding needs network access; nothing was written.`);
  }

  const newest = ((payload as { versions?: PubVersion[] }).versions ?? [])
    .filter((entry) => entry.retracted !== true && !entry.version.includes("-"))
    .filter((entry) => {
      const constraint = entry.pubspec?.dependencies?.eigen_api;
      return typeof constraint === "string" && compatibilityLine(constraint) === line;
    })
    .sort((left, right) => compareVersions(right.version, left.version))[0];

  if (!newest) {
    throw new Error(`no published eigen_flutter speaks engine ${line}.x — every release on pub.dev constrains a different eigen_api line. The pairing is documented at https://eigeninteractive.com/docs/reference/compatibility.`);
  }
  return `^${newest.version}`;
}

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

export async function scaffoldGame(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const root = resolve(options.directory);
  const name = gameSlug(basename(root));
  const manager = options.packageManager ?? detectPackageManager() ?? "pnpm";
  const org = options.org?.trim() || "com.example";
  const bootstrap = options.bootstrap ?? true;
  const run = options.run ?? ((command, args, cwd) => execFileSync(command, args, { cwd, stdio: "inherit" }));
  const fetchJson = options.fetchJson ?? fetchJsonOverHttps;

  if (existsSync(root)) throw new Error(`target already exists: ${root}`);

  // Resolved before anything is created, so a network failure costs a failed
  // command and nothing else — no directory, no partial project to clean up.
  const flutterClientRange = bootstrap ? await resolveFlutterClientRange(engineVersion, fetchJson) : undefined;

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
      run("flutter", ["pub", "add", `eigen_flutter@${flutterClientRange}`, "firebase_core@^4.9.0", "firebase_messaging@^16.2.2"], appRoot);
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
