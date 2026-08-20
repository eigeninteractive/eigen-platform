import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENGINE_PACKAGE, engineRange } from "./engine-range.js";
import { type FirebaseLink, readFirebaseLink } from "./link-firebase.js";

export type { FirebaseLink } from "./link-firebase.js";

export type PackageManager = "npm" | "pnpm";

export type Runner = (command: string, args: string[], cwd: string) => void;

/**
 * Where a scaffold says what it is doing, so that presentation belongs to the
 * caller and this module only has to name things.
 *
 * The default is the behaviour a library caller expects with no opinion:
 * subprocesses inherit the terminal and warnings go to `console.warn`. The CLI
 * substitutes one that captures each step's output and shows it only if the
 * step fails.
 */
export interface Reporter {
  /** Runs `body` as one named step. Its subprocesses can be captured. */
  step<T>(label: string, body: () => T): T;
  /**
   * Runs `body` as a step that owns the terminal, because something inside it
   * asks questions. FlutterFire is the only one.
   */
  handOver<T>(label: string, body: () => T): T;
  /** Output from a subprocess inside the current step. */
  emit(output: string): void;
  /** A failure the scaffold survives. */
  warn(message: string): void;
  /** Whether subprocesses must inherit the terminal rather than be captured. */
  readonly interactive: boolean;
}

/**
 * Gives a terminal that reports no width the width clack would have assumed.
 *
 * A pty can report itself as a TTY and set `columns` to 0. `script` does, and
 * so do some container terminals. clack falls back to 80 for a stream with no
 * `columns` at all, but `0` is a number and satisfies that check, so the width
 * it draws its rules from goes negative and a scaffold dies partway through
 * with `RangeError: Invalid string length`. Supplying the default its check
 * misses is better than giving up the drawing.
 */
export function normaliseTerminalWidth(stream: { isTTY?: boolean; columns?: number }): void {
  if (stream.isTTY === true && (stream.columns ?? 0) < 1) stream.columns = 80;
}

/** Runs every step plainly, which is what a library caller gets by default. */
export const plainReporter: Reporter = {
  step: (_label, body) => body(),
  handOver: (_label, body) => body(),
  emit: (output) => process.stdout.write(output),
  warn: (message) => console.warn(`create-eigen-game: ${message}`),
  interactive: true,
};

/**
 * The runner a scaffold uses when the caller has not supplied one: it asks the
 * reporter whether the terminal is spoken for.
 *
 * `interactive` inherits, which is the only way FlutterFire can put a question
 * on screen and read the answer. Otherwise both streams are captured and
 * handed to the reporter: on success so it can discard them, and on failure
 * so the reason survives.
 */
export function capturingRunner(reporter: Reporter): Runner {
  return (command, args, cwd) => {
    if (reporter.interactive) {
      execFileSync(command, args, { cwd, stdio: "inherit" });
      return;
    }
    try {
      reporter.emit(execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
    } catch (error: unknown) {
      // Both streams, because which one a tool failed on is its own business:
      // pub explains itself on stdout, Gradle on stderr.
      const { stdout, stderr } = error as { stdout?: string; stderr?: string };
      reporter.emit(`${stdout ?? ""}${stderr ?? ""}`);
      throw error;
    }
  };
}

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
   * Emit the GitHub Actions workflows. Off by default; see the call site for
   * why, and `addContinuousIntegration` for adding them to an existing
   * project later.
   */
  ci?: boolean;
  /**
   * Initialise a repository and commit the scaffold. Defaults to `bootstrap`,
   * because the commit is only worth having once the generated files exist.
   */
  git?: boolean;
  /**
   * Configure Firebase before the first commit, by running the Flutter
   * client's `configure_firebase`. A string names the project to use; `true`
   * lets FlutterFire ask, which is also where a project can be created.
   *
   * Explicit here, though the CLI turns it on by default: this is the one step
   * that reaches outside the destination directory, and a library caller
   * should say so rather than discover it. {@link firebaseReadiness} is how
   * the CLI decides.
   */
  firebase?: boolean | string;
  /**
   * Runs the bootstrap subprocesses. A seam: the tests substitute a recorder,
   * and `scripts/scaffold-e2e.mjs` wraps it to point the generated server at
   * this workspace's engine rather than npm's copy.
   */
  run?: Runner;
  /**
   * Where the scaffold says what it is doing. See {@link Reporter}; the
   * default runs every step plainly.
   */
  reporter?: Reporter;
}

/**
 * What became of the repository, so the CLI's closing summary can say rather
 * than guess. `failed` has already warned by the time it is returned, and
 * carries no advice of its own.
 */
export type GitOutcome = "committed" | "existing" | "skipped" | "failed";

export interface ScaffoldResult {
  root: string;
  name: string;
  git: GitOutcome;
  /**
   * Whether Firebase was configured, so the summary can either stop naming the
   * step or spell it out. `failed` has already warned.
   */
  firebase: "configured" | "failed" | "skipped";
  /**
   * What the Firebase step made knowable and this scaffold therefore filled
   * in. Absent unless `firebase` is `configured`, since there is nothing to
   * read otherwise.
   */
  link?: FirebaseLink;
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templatesRoot = resolve(packageRoot, "templates");

/**
 * The engine range emitted into a scaffolded project's package.json.
 *
 * Read from this package's `@eigeninteractive/server` devDependency rather than
 * from its own version. See `engine-range.ts` for why that is the version the
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
 * specific Dart API. `eigen_flutter` is published and versioned separately from
 * this package even though both now live in the platform monorepo, so a source
 * location cannot compute which released version the template should request.
 * Only compiling a scaffolded app establishes it, which the platform gate does
 * on every change.
 *
 * This briefly resolved from pub.dev instead: "the newest `eigen_flutter` whose
 * own `eigen_api` constraint targets the engine line being scaffolded". That
 * predicate is wrong. The `eigen_api` constraint describes the WIRE the shell
 * speaks, not the Dart API these templates call, and the two move
 * independently: a future `eigen_flutter` may legitimately keep `eigen_api:
 * ^0.2.0` while renaming everything the templates touch. It would have been
 * selected, and the generated app would not compile.
 *
 * A caret RANGE rather than an exact version, so it still improves without a
 * republish: `flutter pub add eigen_flutter@^0.4.0` already picks the newest
 * 0.4.x at scaffold time, which is the part the pub.dev lookup was duplicating.
 * What it deliberately cannot do is cross to 0.5.x, the one move that needs a
 * human to confirm the templates still compile.
 *
 * Staleness is therefore a failing check rather than a broken scaffold: this is
 * only ever a release behind, never wrong.
 *
 * Raised to 0.4.0 with the engine's session-snapshot wire. This is the one kind
 * of bump that is not merely an improvement: a scaffold writes both halves, and
 * the worker half is this repository's own line, so the shell it installs has to
 * speak that line's socket. `eigen_flutter` 0.4.0 is the first that does, and
 * every 0.3.x pins `eigen_api: ^0.2.0`, which cannot read a 0.3.x engine at all.
 * A scaffold pinning 0.3.x would therefore resolve, compile, and then fail to
 * render a game, which is the worst of the three.
 *
 * Raised to 0.4.1 for `EngineConfig.authDomain`, which the generated
 * `main.dart` passes. Additive, so pre-1.0 it is a patch and `^0.4.0` would
 * still resolve it, but `^0.4.0` also still resolves 0.4.0, where the parameter
 * does not exist and the scaffold would not compile. The floor is what makes
 * the generated code and the installed shell agree.
 *
 * Raised to 0.6.0 with the engine's opaque pagination cursors, and this is the
 * same *required* kind of bump the 0.4.0 note describes rather than an
 * improvement. The 0.4.x engine line takes `cursor` as an opaque string and
 * returns `nextCursor` on every paged response; `eigen_flutter` 0.6.0 is the
 * first shell that pins `eigen_api: ^0.4.0` and can read it. Everything below
 * that pins `eigen_api: ^0.3.0` or older, so a scaffold left on `^0.4.1` would
 * install the engine's current line beside a shell that cannot read a single
 * paged list from it: it resolves, it compiles, and then the lobby and history
 * are empty. 0.5.0 is skipped for the same reason, being a web-design release
 * that still speaks the 0.3.x wire.
 *
 * Raised to 0.7.0 for the 0.5.x engine line and the `PlayerLimits` client API.
 * vNext later simplified the wire again: versions are a contiguous prefix and
 * generic mutation identities are gone. The next Flutter release must raise
 * this floor before the corresponding scaffolder is published.
 *
 * Note that this floor and the engine range are raised in one commit on
 * purpose. The scaffolder writes both halves, and `updateInternalDependencies`
 * republishes this package whenever the engine version moves, so between an
 * engine line crossing and this line moving there is a published scaffolder
 * that pairs a new worker with an old shell. That window is real and this is
 * what closes it.
 *
 * The 0.7.0 raise is the exception that shows where that promise cannot hold. A
 * floor names a *published* `eigen_flutter`, and `eigen_flutter` publishes at the
 * end of the release chain, after the npm packages this scaffolder ships with --
 * so at the moment the engine crossed to 0.5.x there was no 0.7.0 to point at,
 * and `create-eigen-game@0.12.0` went out pairing a `^0.5.0` worker with a 0.6.0
 * shell. A Flutter line move therefore costs a follow-up scaffolder patch, and
 * `scripts/scaffold-e2e.mjs` is what refuses to let it be forgotten: it resolves
 * both halves for real and compares the wire lines they land on.
 */
const flutterClientVersion = "^0.7.0";

/** Development-only contract compiler installed into the generated app. */
const dartCodegenVersion = "^0.1.0";

const gameSlug = (value: string): string => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error("destination directory name must be a lowercase kebab-case slug, for example my-game");
  }
  return value;
};

const dartName = (value: string): string => value.replaceAll("-", "_");

/**
 * The Android `applicationId`, and iOS bundle id, a scaffold at `directory`
 * will produce, so the CLI can show it rather than describe it.
 *
 * `flutter create --org X --project-name Y` derives `X.Y`. The organization is
 * the *prefix*, not the whole identifier, which is the part worth seeing
 * before answering: Google Play makes it permanent at first upload.
 */
export function applicationId(directory: string, org?: string): string {
  return `${org?.trim() || "com.example"}.${dartName(gameSlug(basename(resolve(directory))))}`;
}

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

/**
 * Substitutes the scaffold's tokens, of which there are two deliberate kinds.
 *
 * `{{BRACED}}` for values that have no valid example: a package manager,
 * an engine version, an Android package id. They appear only in manifests,
 * READMEs, workflows and the `Appfile`: files nothing compiles.
 *
 * Bare words (`ExampleGame`, `example-game`, …) for names a real example game
 * genuinely has. This is what keeps `templates/worker` and the Dart templates
 * VALID, COMPILING SOURCE rather than text with holes in it, which the rest of
 * this package leans on hard: `typecheck` runs `tsc` over `templates/worker`,
 * the tests `import` its game module directly and build a real contract from
 * it, and the `scaffold` job compiles the Dart templates. Bracing these would
 * trade all of that for a marker.
 *
 * The cost, and the one rule for template authors: a template file cannot
 * contain the literal string `example-game`, `Example Game`, `ExampleGame` or
 * `example_game` and keep it; every occurrence is rewritten, in prose and in
 * code alike. Write around it, or brace a new token instead.
 *
 * Note this means the set of files carrying a token changes whenever someone
 * writes one into an existing file. Nothing needs to track that: `renderTree`
 * decides what to rewrite from the bytes, not from a list of paths.
 */
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
 * True when the bytes are valid UTF-8.
 *
 * This is not a guess at whether a file is "binary"; it is the precondition
 * of the operation. Token substitution is `String.replaceAll`, so a file that
 * cannot be decoded cannot take part, and one that can is safe to rewrite.
 *
 * Deliberately not an extension list. A DENY list (`.png`, `.jar`, …) fails
 * silently in the dangerous direction: the day someone adds a `.webp`, it is
 * corrupted with no error. An ALLOW list fails the safe way but fits this tree
 * badly: `Gemfile`, `Fastfile`, `.nvmrc`, `.fvmrc` and `.ruby-version` all
 * need rendering and none carry a usable extension, so it would have to be a
 * list of extensions *and* a list of bare filenames, both drifting.
 *
 * `.template` is not the signal either, despite the name: it marks files a
 * language server must not claim before they have an enclosing package. Five
 * of them contain no token at all, and nine token-bearing files are not
 * marked, so the two concepts are orthogonal here.
 *
 * `renderTree`'s test pins the resulting classification for the whole tree, so
 * this stays a reviewed decision rather than an invisible one.
 */
const utf8 = new TextDecoder("utf-8", { fatal: true });

export function decodeUtf8(bytes: Buffer): string | undefined {
  try {
    return utf8.decode(bytes);
  } catch {
    return undefined;
  }
}

function renderTree(source: string, destination: string, name: string, manager: PackageManager, packageId: string): void {
  cpSync(source, destination, { recursive: true });
  // Walks the TEMPLATE, not the destination. The app overlay renders on top of
  // a `flutter create` result, so walking the destination meant rewriting
  // every file Flutter had just generated, including its binaries, for files
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
      const text = decodeUtf8(readFileSync(templatePath));
      // Undecodable files are already in place from the copy above, byte for
      // byte. Only decodable ones are rewritten.
      if (text !== undefined) {
        writeFileSync(rendered, render(text, name, manager, packageId));
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

function packageCommand(manager: PackageManager, operation: "install" | "contract" | "cf-typegen"): [string, string[]] {
  if (operation === "install") return [manager, ["install"]];
  return [manager, ["run", operation]];
}

/**
 * Appends `block` to a file this scaffolder does not own, as its own paragraph.
 *
 * **Append, never insert.** That is the rule the three callers below follow, and
 * it is what keeps them from competing with `flutter create` and `flutterfire
 * configure` for position in the same files. A pure append cannot collide with
 * whatever those tools write above it; the one edit here that ever needed a
 * position, prepending a Kotlin `import`, was broken by an AGP upgrade and has
 * since been rewritten away. See MAINTAINERS.md for the whole doctrine, including
 * why FlutterFire's `// START:`/`// END:` marker comments are deliberately not
 * copied.
 *
 * `contents` is passed in rather than read here because every caller has already
 * read the file to decide whether its block is present, and two of them assert
 * on the shape of what they found. This owns the whitespace and nothing else.
 *
 * That is worth one function because it was previously written three times with
 * two different answers, so the desugaring block got a blank line before it and
 * the other two did not, and the two Gradle blocks ended up flush against each
 * other in every generated project. Separation belongs to the append, so the
 * block constants carry no leading or trailing newline of their own.
 */
function appendBlock(path: string, contents: string, block: string): void {
  appendFileSync(path, `${contents.endsWith("\n") ? "" : "\n"}\n${block}\n`);
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
  appendBlock(gradlePath, gradle, androidDesugaring);
}

// A second top-level `android { }` block is valid Gradle Kotlin DSL, since Gradle
// merges repeated extension-configuration blocks in one file, which is what
// lets this stay a pure append, same as the desugaring block above. A second
// top-level `plugins { }` block is NOT valid (Gradle allows exactly one per
// script), which is why the Crashlytics Gradle plugin registration,
// `flutterfire configure`'s own territory, is deliberately left alone here.
//
// Parsed with the Kotlin stdlib rather than `java.util.Properties`, which is
// what keeps this appendable. `Properties` would need a real `import`, and
// Kotlin requires imports before every other top-level declaration, so using it
// meant also reaching into the very start of a file this scaffolder does not
// own. A fully-qualified `java.util.Properties()` reference was tried to avoid
// that, and does not resolve under AGP 9's Kotlin DSL script compilation
// (`flutter create`'s current default): "Unresolved reference 'util'".
// Confirmed by actually building a scaffolded project, not just reading it.
const androidReleaseSigning = `val releaseKeyProperties: Map<String, String> =
    rootProject.file("key.properties")
        .takeIf { it.exists() }
        ?.readLines()
        ?.map { it.trim() }
        ?.filter { it.isNotEmpty() && !it.startsWith("#") && it.contains("=") }
        ?.associate { it.substringBefore("=").trim() to it.substringAfter("=").trim() }
        .orEmpty()

android {
    signingConfigs {
        create("release") {
            storeFile = releaseKeyProperties["storeFile"]?.let { file(it) }
            storePassword = releaseKeyProperties["storePassword"]
            keyAlias = releaseKeyProperties["keyAlias"]
            keyPassword = releaseKeyProperties["keyPassword"]
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
  // Not `gradle.includes("signingConfigs")`, because Flutter's own template already
  // contains that substring (`signingConfig = signingConfigs.getByName("debug")`),
  // so that check would always short-circuit and never append anything.
  if (gradle.includes("releaseKeyProperties")) return;
  // A pure append. This previously also PREPENDED `import java.util.Properties`,
  // the most position-dependent edit here and the one already broken once by an
  // AGP upgrade; see the block above for what replaced it.
  appendBlock(gradlePath, gradle, androidReleaseSigning);
}

// `flutter_launcher_icons`/`flutter_native_splash` read these as plain
// top-level pubspec keys, so appending is safe regardless of what
// `flutter create` already wrote under `flutter:`. Deliberately omits
// `ios`/`macos`, since `scaffoldGame` only creates `--platforms android,web`, and
// `flutter_launcher_icons` errors if told to target a platform whose
// directory doesn't exist.
// The colours are the EigenInteractive palette (ink #1B1E24, paper #F4F1EA) because the
// shipped placeholder art is the EigenInteractive mark: the adaptive foreground is the
// reversed, light-on-dark variant, so an ink background is what makes it
// legible. Rebranding a game means replacing the four PNGs *and* these
// colours together. See https://eigeninteractive.com/docs/ship-it/branding.
const launcherIconsAndSplashConfig = `flutter_launcher_icons:
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
  web: true`;

function configureLauncherIconsAndSplash(appRoot: string): void {
  const pubspecPath = resolve(appRoot, "pubspec.yaml");
  const pubspec = readFileSync(pubspecPath, "utf8");
  if (pubspec.includes("flutter_launcher_icons:")) return;
  appendBlock(pubspecPath, pubspec, launcherIconsAndSplashConfig);
}

export interface AddContinuousIntegrationOptions {
  directory: string;
  /** Overrides the manager recorded in the project's own package.json. */
  packageManager?: PackageManager;
}

/**
 * Adds the GitHub Actions workflows to an existing generated project.
 *
 * The companion to `ci: false`: a game can be built and played locally for as
 * long as its author likes, then gain the same PR gate and signed release
 * pipeline a `--ci` scaffold would have produced.
 */
export function addContinuousIntegration(options: AddContinuousIntegrationOptions): { root: string; files: string[] } {
  const root = resolve(options.directory);
  const manifestPath = resolve(root, "package.json");
  if (!existsSync(manifestPath) || !existsSync(resolve(root, "server")) || !existsSync(resolve(root, "app"))) {
    throw new Error(`not an EigenInteractive game project (expected package.json, server/ and app/): ${root}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  const name = gameSlug(manifest.name ?? basename(root));

  // The generated `contract` script embeds the manager the project was
  // scaffolded with (`cd server && pnpm run contract && …`), which is a more
  // reliable signal than a lockfile: it is present before anything is
  // installed, and it is what the project actually uses.
  const recorded = manifest.scripts?.contract?.includes("pnpm ") ? "pnpm" : manifest.scripts?.contract?.includes("npm ") ? "npm" : undefined;
  const manager = options.packageManager ?? recorded ?? detectPackageManager() ?? "pnpm";

  // Only `{{PACKAGE_MANAGER}}` appears in these templates, but the real
  // package id is read back rather than reconstructed, so a project scaffolded
  // under a different `--org` cannot be silently rewritten to `com.example`.
  const appfile = resolve(root, "app/fastlane/Appfile");
  const packageId = existsSync(appfile) ? (/package_name\("([^"]+)"\)/.exec(readFileSync(appfile, "utf8"))?.[1] ?? `com.example.${dartName(name)}`) : `com.example.${dartName(name)}`;

  const workflows = resolve(root, ".github/workflows");
  const existing = existsSync(workflows) ? readdirSync(workflows).filter((f) => f === "checks.yml" || f === "release.yml") : [];
  if (existing.length > 0) {
    throw new Error(`refusing to overwrite existing workflows: ${existing.join(", ")}`);
  }

  renderTree(resolve(templatesRoot, "ci"), root, name, manager, packageId);
  return { root, files: [".github/workflows/checks.yml", ".github/workflows/release.yml"] };
}

/** Asks a command a question. `ok` is "ran and succeeded"; a tool that is not installed and one that fails are both `false`, because neither can be used. */
export type Probe = (command: string, args: string[]) => { ok: boolean; stdout: string };

const probeCommand: Probe = (command, args) => {
  try {
    return { ok: true, stdout: execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }) };
  } catch {
    return { ok: false, stdout: "" };
  }
};

/** One thing standing between this machine and a configured Firebase project, and the single command that clears it. */
export interface FirebaseProblem {
  /** Said as a sentence fragment, so it reads after "Firebase is not set up here:". */
  reason: string;
  /** The one command that fixes this, and nothing else. */
  fix: string;
}

export type FirebaseReadiness = { ready: true } | { ready: false; problems: FirebaseProblem[] };

/**
 * Whether this machine can configure Firebase, asked *before* the scaffold
 * rather than after it.
 *
 * `configure_firebase` runs the same three checks and is the authority on
 * them; this one exists only to move the answer earlier. Learning that
 * `flutterfire` is missing costs nothing here and costs two minutes of Flutter
 * and pub at the far end, which is where the step actually runs.
 *
 * Every problem, not the first one. The checks are independent (two CLIs from
 * two ecosystems, plus a sign-in) so short-circuiting turns one setup into a
 * sequence of runs that each reveal the next missing piece. Reported in the
 * order they have to be fixed in: the CLI, then the sign-in it stores, then
 * the bridge that consumes both.
 *
 * The sign-in check fails open, for the same reason it does there: only an
 * answer that positively reports no accounts counts as "no", so a `firebase`
 * that errors or grows a different output shape is left to the command that
 * actually needs the credentials.
 */
export function firebaseReadiness(probe: Probe = probeCommand): FirebaseReadiness {
  const problems: FirebaseProblem[] = [];

  if (probe("firebase", ["--version"]).ok) {
    if (signedOut(probe)) problems.push({ reason: "no Google account is signed in to the Firebase CLI", fix: "firebase login" });
  } else {
    // Nothing to say about the sign-in: the CLI that would answer is the one
    // that is missing, and `firebase login` is what installing leads to anyway.
    // Google's own installer, which picks a standalone binary or npm to suit
    // the machine. `npm install -g firebase-tools` also works and is what this
    // used to print, but it needs a global npm prefix the reader may not have
    // write access to, and it is not the install the Firebase docs lead with.
    problems.push({ reason: "the `firebase` CLI is not installed", fix: "curl -sL https://firebase.tools | bash" });
  }

  if (!probe("flutterfire", ["--version"]).ok) {
    problems.push({ reason: "the `flutterfire` CLI is not installed", fix: "dart pub global activate flutterfire_cli" });
  }

  return problems.length === 0 ? { ready: true } : { ready: false, problems };
}

/**
 * Whether the Firebase CLI holds no credentials.
 *
 * `login:list --json` prints the stored refresh and access tokens along with
 * the account list. Read the shape, count the entries, and never surface the
 * output: not in a warning, not in a captured stream, not on the failure
 * path. That is why this returns a boolean rather than the response.
 */
function signedOut(probe: Probe): boolean {
  const accounts = probe("firebase", ["login:list", "--json"]);
  if (!accounts.ok) return false;
  try {
    const { result } = JSON.parse(accounts.stdout) as { result?: unknown };
    return Array.isArray(result) && result.length === 0;
  } catch {
    // Unparseable is not evidence of anything.
    return false;
  }
}

/**
 * Whether the scaffold would land inside a repository that already exists.
 *
 * Asked of the nearest ancestor that exists, because the destination does not
 * yet. The point is not to change what {@link scaffoldGame} does, which already
 * declines to nest a repository, but to stop the CLI asking a question whose
 * answer cannot matter.
 */
/**
 * Why this destination cannot be scaffolded into, said as a whole message, or
 * `undefined` when there is nothing in the way.
 *
 * A directory that exists and is *empty* is not in the way, since people make
 * one out of habit, so it is removed and rewritten rather than refused over
 * nothing. Anything with contents in it is refused, and a cloned repository is
 * not an exception: `.git` is in the way like any other entry, and the message
 * names it. Publishing into one would mean parking `.git`, renaming staging
 * over the top and putting it back, with a failure in the middle able to
 * orphan a remote, which is a lot of care to spend on a flow that has a
 * one-line alternative.
 *
 * Refused, and deliberately not offered as a "remove it and continue?"
 * question, which is where several scaffolders in this family go. This one
 * writes ninety-odd files and runs `flutter create`; the cost of getting that
 * answer wrong against a mistyped path has no upper bound, and `rm -rf` is one
 * command that belongs to the person who can see what is in there. Every other
 * question this CLI asks is reversible. This one would not be.
 *
 * Exported so the CLI can ask it before the first question rather than after
 * the last one. {@link scaffoldGame} asks it again, for callers that are not
 * the CLI.
 */
export function destinationProblem(directory: string): string | undefined {
  const root = resolve(directory);
  if (!existsSync(root)) return undefined;

  if (!statSync(root).isDirectory()) return `${root} already exists, and is a file.`;

  const entries = readdirSync(root);
  if (entries.length === 0) return undefined;

  // Named, not counted. "not empty" invites an `ls`; the three that are
  // actually there usually settle whether this was the wrong path or a
  // directory that has already been scaffolded once.
  const shown = entries.slice(0, 3).sort().join(", ");
  const rest = entries.length > 3 ? `, and ${entries.length - 3} more` : "";
  return `${root} already exists, and is not empty: it holds ${shown}${rest}.\n\nScaffold somewhere else, or clear it out yourself. This will not delete a directory you already had.`;
}

export function insideWorkTree(directory: string, probe: Probe = probeCommand): boolean {
  let candidate = resolve(directory);
  while (!existsSync(candidate)) {
    const parent = dirname(candidate);
    if (parent === candidate) return false;
    candidate = parent;
  }
  return probe("git", ["-C", candidate, "rev-parse", "--is-inside-work-tree"]).ok;
}

/**
 * Runs the Flutter client's `configure_firebase` against the generated app.
 *
 * The command owns everything about how Firebase is configured: which
 * platforms, which CLIs must exist, whether anyone is signed in, and what to
 * do when no project has been chosen yet. This only decides *when*: before the
 * scaffold commit, so a configured project is committed configured.
 *
 * Not fatal. Every failure here (a missing `flutterfire`, no Google login, a
 * cancelled picker) leaves a complete and usable project that is exactly what
 * a scaffold without `--firebase` produces, so it warns with the command to
 * re-run and lets the commit happen.
 */
function configureFirebase(appRoot: string, project: boolean | string, run: Runner, reporter: Reporter): "configured" | "failed" {
  // FlutterFire asks before overwriting `firebase_options.dart`, and the
  // scaffold has just written one, a throwing placeholder whose entire
  // purpose is to be replaced by this step. Answering that is a question with
  // one right answer, so the placeholder is moved out of the way and the
  // question never gets asked.
  const placeholder = resolve(appRoot, "lib/firebase_options.dart");
  const parked = `${placeholder}.placeholder`;
  const parking = existsSync(placeholder);
  if (parking) renameSync(placeholder, parked);

  try {
    // `dart run` compiles the package executable on first use and says so.
    // Doing it against `--help`, which returns immediately, moves that noise
    // into a step whose output can be captured; the real run cannot be, since
    // FlutterFire prompts through it.
    reporter.step("Preparing the Firebase configurator", () => run("dart", ["run", "eigen_flutter:configure_firebase", "--help"], appRoot));
    // `--worker` is what makes this fill in `FIREBASE_PROJECT_ID` as well as
    // the app's own values. An app-only repository omits it and gets the app
    // half; a combined scaffold has the Worker one directory over.
    reporter.handOver("Configuring Firebase", () => run("dart", ["run", "eigen_flutter:configure_firebase", "--worker", "../server", ...(typeof project === "string" ? ["--project", project] : [])], appRoot));
    if (parking) rmSync(parked, { force: true });
    return "configured";
  } catch {
    // Back only if nothing took its place. FlutterFire writes
    // `firebase_options.dart` before the service worker configuration is
    // derived from it, so a late failure leaves a real one that is worth more
    // than the placeholder.
    if (parking) {
      if (existsSync(placeholder)) rmSync(parked, { force: true });
      else renameSync(parked, placeholder);
    }
    reporter.warn("Could not configure Firebase. The project is complete. Run `firebase:configure` yourself, then commit what it writes.");
    return "failed";
  }
}

/**
 * Commits the scaffold, so the first `git diff` is the first game change.
 *
 * This matters more here than in a scaffolder that only writes source. The
 * bootstrap runs `flutter_launcher_icons` and `flutter_native_splash`, which
 * write generated-but-committed files across `android/`, `web/` and
 * `assets/`; without a baseline the first branding change is indistinguishable
 * from the ninety files the scaffolder happened to produce.
 *
 * Nothing here is fatal. The project is complete and valid before this runs,
 * so a missing `git`, or the unconfigured `user.email` that a fresh CI image
 * has, warns and leaves the tree alone rather than discarding a scaffold that
 * took two minutes of Flutter and pub to produce.
 */
function initialiseRepository(root: string, name: string, run: Runner, reporter: Reporter): GitOutcome {
  // Scaffolding inside an existing checkout (a monorepo, or a repository
  // created ahead of time) is a legitimate thing to do, and a nested
  // repository there is silent breakage: the outer `git add` records a gitlink
  // and the app's files never leave the machine. Asked directly rather than
  // through `run`, because it is a question, not a step.
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, stdio: "ignore" });
    return "existing";
  } catch {
    // Not inside a work tree, which is the case this function is for.
  }

  try {
    run("git", ["init", "--quiet"], root);
    run("git", ["add", "--all"], root);
  } catch {
    reporter.warn("Could not initialise a git repository. The project is complete. Run `git init` yourself when ready.");
    return "failed";
  }

  try {
    run("git", ["commit", "--quiet", "--message", `Scaffold ${name}`], root);
  } catch {
    reporter.warn(`Initialised a repository and staged the scaffold, but could not commit it. Set \`user.name\` and \`user.email\`, then \`git commit -m "Scaffold ${name}"\`.`);
    return "failed";
  }

  return "committed";
}

export function scaffoldGame(options: ScaffoldOptions): ScaffoldResult {
  const root = resolve(options.directory);
  const name = gameSlug(basename(root));
  const manager = options.packageManager ?? detectPackageManager() ?? "pnpm";
  const org = options.org?.trim() || "com.example";
  // Fastlane's `Appfile` names the same package the build actually produces,
  // and the CLI shows the same one before asking.
  const packageId = applicationId(root, org);
  const bootstrap = options.bootstrap ?? true;
  const reporter = options.reporter ?? plainReporter;
  const run = options.run ?? capturingRunner(reporter);

  const occupied = destinationProblem(root);
  if (occupied !== undefined) throw new Error(occupied);
  // Empty, or `destinationProblem` would have said so. Removed rather than
  // scaffolded into, because the rename below publishes the staging directory
  // *as* this path and cannot do that while something is standing there.
  if (existsSync(root)) rmdirSync(root);

  mkdirSync(dirname(root), { recursive: true });

  // Build beside the destination and publish it with one rename. Failed
  // subprocesses never leave a half-scaffolded project at the requested path.
  const stagingRoot = mkdtempSync(resolve(dirname(root), `.${basename(root)}-`));
  try {
    const serverRoot = resolve(stagingRoot, "server");
    const appRoot = resolve(stagingRoot, "app");

    renderTree(resolve(templatesRoot, "worker"), serverRoot, name, manager, packageId);
    renderTree(resolve(templatesRoot, "project"), stagingRoot, name, manager, packageId);
    // Opt-in. release.yml wants an upload keystore and a Play service account
    // that a brand-new project does not have, so generating it by default
    // means a red X on main from the first push until someone sets both up.
    // `create-eigen-game add ci` writes the same files whenever it is wanted.
    if (options.ci) renderTree(resolve(templatesRoot, "ci"), stagingRoot, name, manager, packageId);

    if (bootstrap) {
      reporter.step("Creating the Flutter app", () => {
        run("flutter", ["create", "--empty", "--platforms", "android,web", "--project-name", dartName(name), "--org", org, appRoot], stagingRoot);
        enableAndroidCoreLibraryDesugaring(appRoot);
        enableAndroidReleaseSigning(appRoot);
      });
    } else {
      mkdirSync(appRoot, { recursive: true });
    }
    renderTree(resolve(templatesRoot, "app-overlay"), appRoot, name, manager, packageId);

    if (bootstrap) {
      reporter.step("Adding the Flutter packages", () => {
        configureLauncherIconsAndSplash(appRoot);
        run("flutter", ["pub", "add", `eigen_flutter@${flutterClientVersion}`, "firebase_core@^4.9.0", "firebase_messaging@^16.2.2"], appRoot);
        run("flutter", ["pub", "add", `dev:eigen_codegen@${dartCodegenVersion}`, "dev:flutter_launcher_icons", "dev:flutter_native_splash"], appRoot);
      });
      // Actually apply the icons rather than only configuring them. Both tools
      // write generated files (mipmaps, `web/icons/`, splash drawables and
      // styles) that are committed, not built; leaving them unrun would ship
      // Flutter's own blue logo until a game author happened to notice.
      reporter.step("Generating the icons and splash", () => {
        run("dart", ["run", "flutter_launcher_icons"], appRoot);
        run("dart", ["run", "flutter_native_splash:create"], appRoot);
      });
      const [install, installArgs] = packageCommand(manager, "install");
      const [typegen, typegenArgs] = packageCommand(manager, "cf-typegen");
      reporter.step("Installing the Worker packages", () => {
        run(install, installArgs, serverRoot);
        // `worker-configuration.d.ts` is committed, and its header stamps the
        // workerd version that produced the runtime types. `wrangler` floats
        // on a caret and Cloudflare ships workerd about weekly, so the copy in
        // `templates/worker` is stale for every scaffold made more than a few
        // days after it was last regenerated, and `wrangler dev` opens by
        // saying the types might be out of date. Regenerating against the
        // wrangler that was just installed, rather than the one this package
        // was built with, is what makes that true. It has to follow the server
        // install for the same reason it is worth doing: it reads the wrangler
        // that install resolved.
        run(typegen, typegenArgs, serverRoot);
        // The root holds Biome, which lints and formats both the Worker and
        // the repository's own JSON. Installed after the server so a failure
        // here costs the cheaper of the two.
        run(install, installArgs, stagingRoot);
      });
      const [contract, contractArgs] = packageCommand(manager, "contract");
      reporter.step("Generating the contract and payloads", () => {
        run(contract, contractArgs, serverRoot);
        run("dart", ["run", "eigen_codegen:generate_payloads", "--contract", "../server/game-contract.json", "--output", "lib/game/generated/payloads.dart", "--fixtures-output", "test/fixtures"], appRoot);
      });
    }

    renameSync(stagingRoot, root);
  } catch (error) {
    rmSync(stagingRoot, { recursive: true, force: true });
    throw error;
  }

  // Both steps below are deliberately outside the staging guard: the project
  // is published by this point, and neither a Firebase project that could not
  // be configured nor a repository that failed to initialise is a reason to
  // delete two minutes of Flutter and pub.
  //
  // Firebase first, so what it writes (`firebase.json`,
  // `android/app/google-services.json`, the real `firebase_options.dart` and
  // `web/firebase-config.js` in place of the throwing placeholders, and
  // FlutterFire's two Gradle edits) lands in the scaffold commit rather than
  // arriving as the project's first diff.
  const firebase = options.firebase ? configureFirebase(resolve(root, "app"), options.firebase, run, reporter) : "skipped";
  // What that step settled, so the summary can name what it did not.
  // `configure_firebase` does the writing, including into the Worker's
  // wrangler.jsonc, which is what `--worker` above is for.
  const link = firebase === "configured" ? readFirebaseLink(root) : undefined;
  const git = (options.git ?? bootstrap) ? initialiseRepository(root, name, run, reporter) : "skipped";

  return { root, name, git, firebase, link };
}
