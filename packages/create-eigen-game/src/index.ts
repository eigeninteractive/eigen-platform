import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
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

function render(contents: string, name: string, manager: PackageManager, packageId: string): string {
  const replacements: ReadonlyArray<readonly [string, string]> = [
    ["@game/example-game-server", `@game/${name}-server`],
    ["{{PACKAGE_MANAGER}}", manager],
    ["{{PACKAGE_ID}}", packageId],
    ["{{ENGINE_VERSION}}", engineVersion],
    ["ExampleGame", identifier(name)],
    ["Example Game", title(name)],
    ["example_game", dartName(name)],
    ["example-game", name],
  ];
  return replacements.reduce((result, [from, to]) => result.replaceAll(from, to), contents);
}

/**
 * True when the bytes survive a UTF-8 round trip.
 *
 * Token substitution is a string operation, so a file has to be decodable to
 * take part in it. Anything else — PNG, ICO, JAR, OTF — is copied through
 * untouched. Sniffing the content rather than keeping a list of binary
 * extensions means a new asset type cannot silently start being mangled.
 */
function isUtf8Text(bytes: Buffer): boolean {
  return Buffer.compare(Buffer.from(bytes.toString("utf8"), "utf8"), bytes) === 0;
}

function renderTree(source: string, destination: string, name: string, manager: PackageManager, packageId: string): void {
  cpSync(source, destination, { recursive: true });
  // Walks the TEMPLATE, not the destination. The app overlay renders on top of
  // a `flutter create` result, so walking the destination meant rewriting
  // every file Flutter had just generated — including its binaries — for files
  // this scaffolder does not own and has no business touching.
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const templatePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        visit(templatePath);
        continue;
      }
      if (!entry.isFile()) continue;

      const rendered = resolve(destination, relative(source, templatePath));
      const bytes = readFileSync(templatePath);
      if (isUtf8Text(bytes)) {
        writeFileSync(rendered, render(bytes.toString("utf8"), name, manager, packageId));
      }
      // Template-only source must not be claimed by language servers before
      // it has an enclosing generated package. Restore the real extension
      // only in the rendered project.
      if (entry.name.endsWith(".template")) {
        renameSync(rendered, rendered.slice(0, -".template".length));
      }
    }
  };
  visit(source);

  // npm deliberately excludes files named `.gitignore` from package
  // tarballs. Their packaged twins live outside the C3 template so a direct
  // Git-based C3 render does not inherit a scaffolder-only helper file.
  const packagedGitignore = resolve(templatesRoot, "scaffold", `${basename(source)}.gitignore`);
  if (existsSync(packagedGitignore)) {
    writeFileSync(resolve(destination, ".gitignore"), render(readFileSync(packagedGitignore, "utf8"), name, manager, packageId));
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

// A second top-level `android { }` block is valid Gradle Kotlin DSL — Gradle
// merges repeated extension-configuration blocks in one file, which is what
// lets this stay a pure append, same as the desugaring block above. A second
// top-level `plugins { }` block is NOT valid (Gradle allows exactly one per
// script), which is why the Crashlytics Gradle plugin registration —
// `flutterfire configure`'s own territory — is deliberately left alone here.
//
// `Properties` needs a real `import`, prepended separately below — a
// fully-qualified `java.util.Properties()` reference here was tried first,
// to avoid needing to touch the top of the file at all, but fails to
// resolve under AGP 9's Kotlin DSL script compilation
// (`flutter create`'s current default): "Unresolved reference 'util'".
// Confirmed by actually building a scaffolded project, not just reading it.
const androidReleaseSigning = `val releaseKeyProperties = Properties().apply {
    val f = rootProject.file("key.properties")
    if (f.exists()) load(f.inputStream())
}

android {
    signingConfigs {
        create("release") {
            storeFile = releaseKeyProperties["storeFile"]?.let { file(it as String) }
            storePassword = releaseKeyProperties["storePassword"] as String?
            keyAlias = releaseKeyProperties["keyAlias"] as String?
            keyPassword = releaseKeyProperties["keyPassword"] as String?
        }
    }
    buildTypes {
        release {
            signingConfig = if (releaseKeyProperties["storeFile"] != null)
                signingConfigs.getByName("release")
            else
                signingConfigs.getByName("debug")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }
}`;

function enableAndroidReleaseSigning(appRoot: string): void {
  const gradlePath = resolve(appRoot, "android/app/build.gradle.kts");
  const gradle = readFileSync(gradlePath, "utf8");
  // Not `gradle.includes("signingConfigs")` — Flutter's own template already
  // contains that substring (`signingConfig = signingConfigs.getByName("debug")`),
  // so that check would always short-circuit and never append anything.
  if (gradle.includes("releaseKeyProperties")) return;
  // Kotlin imports must precede every other top-level declaration, so this is
  // the one piece that has to go at the very START of the file rather than
  // the end. Flutter's generated file has no file-level annotations, so
  // prepending is always syntactically valid here.
  const withImport = `import java.util.Properties\n\n${gradle}`;
  writeFileSync(gradlePath, `${withImport.endsWith("\n") ? withImport : `${withImport}\n`}${androidReleaseSigning}\n`);
}

// `flutter_launcher_icons`/`flutter_native_splash` read these as plain
// top-level pubspec keys, so appending is safe regardless of what
// `flutter create` already wrote under `flutter:`. Deliberately omits
// `ios`/`macos` — `scaffoldGame` only creates `--platforms android,web`, and
// `flutter_launcher_icons` errors if told to target a platform whose
// directory doesn't exist.
// The colours are the Eigen palette (ink #1B1E24, paper #F4F1EA) because the
// shipped placeholder art is the Eigen mark: the adaptive foreground is the
// reversed, light-on-dark variant, so an ink background is what makes it
// legible. Rebranding a game means replacing the four PNGs *and* these
// colours together — see https://eigeninteractive.com/docs/ship-it/branding.
const launcherIconsAndSplashConfig = `
flutter_launcher_icons:
  android: true
  web:
    generate: true
    image_path: "assets/icon/icon.png"
  image_path: "assets/icon/icon.png"
  adaptive_icon_background: "#1B1E24"
  adaptive_icon_foreground: "assets/icon/icon_foreground.png"
  min_sdk_android: 21

flutter_native_splash:
  color: "#F4F1EA"
  color_dark: "#1B1E24"
  image: assets/icon/splash.png
  image_dark: assets/icon/splash_dark.png
  fullscreen: true
  android_12:
    color: "#F4F1EA"
    color_dark: "#1B1E24"
    image: assets/icon/splash.png
    image_dark: assets/icon/splash_dark.png
    icon_background_color: "#F4F1EA"
    icon_background_color_dark: "#1B1E24"
  web: true
`;

function configureLauncherIconsAndSplash(appRoot: string): void {
  const pubspecPath = resolve(appRoot, "pubspec.yaml");
  const pubspec = readFileSync(pubspecPath, "utf8");
  if (pubspec.includes("flutter_launcher_icons:")) return;
  appendFileSync(pubspecPath, `${pubspec.endsWith("\n") ? "" : "\n"}${launcherIconsAndSplashConfig}`);
}

export function scaffoldGame(options: ScaffoldOptions): ScaffoldResult {
  const root = resolve(options.directory);
  const name = gameSlug(basename(root));
  const manager = options.packageManager ?? detectPackageManager() ?? "pnpm";
  const org = options.org?.trim() || "com.example";
  // Mirrors how `flutter create --org` derives the real Android
  // `applicationId`/iOS bundle id, so Fastlane's `Appfile` names the same
  // package the build actually produces.
  const packageId = `${org}.${dartName(name)}`;
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

    renderTree(resolve(templatesRoot, "worker"), serverRoot, name, manager, packageId);
    renderTree(resolve(templatesRoot, "project"), stagingRoot, name, manager, packageId);

    if (bootstrap) {
      run("flutter", ["create", "--empty", "--platforms", "android,web", "--project-name", dartName(name), "--org", org, appRoot], stagingRoot);
      enableAndroidCoreLibraryDesugaring(appRoot);
      enableAndroidReleaseSigning(appRoot);
    } else {
      mkdirSync(appRoot, { recursive: true });
    }
    renderTree(resolve(templatesRoot, "app-overlay"), appRoot, name, manager, packageId);

    if (bootstrap) {
      configureLauncherIconsAndSplash(appRoot);
      run("flutter", ["pub", "add", `eigen_flutter@${flutterClientVersion}`, "firebase_core@^4.9.0", "firebase_messaging@^16.2.2"], appRoot);
      run("flutter", ["pub", "add", "dev:flutter_launcher_icons", "dev:flutter_native_splash"], appRoot);
      // Actually apply the icons rather than only configuring them. Both tools
      // write generated files (mipmaps, `web/icons/`, splash drawables and
      // styles) that are committed, not built — leaving them unrun would ship
      // Flutter's own blue logo until a game author happened to notice.
      run("dart", ["run", "flutter_launcher_icons"], appRoot);
      run("dart", ["run", "flutter_native_splash:create"], appRoot);
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
