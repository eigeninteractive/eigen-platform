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
}

export interface ScaffoldResult {
  root: string;
  name: string;
}

const templatesRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../templates");

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
      run("flutter", ["pub", "add", "eigen_flutter@^0.1.0", "firebase_core@^4.9.0", "firebase_messaging@^16.2.2"], appRoot);
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
