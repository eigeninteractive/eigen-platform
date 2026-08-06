import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import { buildGameContract } from "@eigeninteractive/testkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addContinuousIntegration, decodeUtf8, detectPackageManager, scaffoldGame } from "../src/index.js";
import gameModule from "../templates/worker/src/module/index.js";

const temporaryParent = (): string => mkdtempSync(resolve(tmpdir(), "create-eigen-game-"));

// Read from the engine package rather than written as a literal, because that
// is the invariant under test: the scaffolder emits the version of the engine
// its templates were compiled against. A literal would need editing on every
// release, and would pass while the template silently pinned the previous one.
//
// Note this is the ENGINE's version, no longer the scaffolder's — the two are
// free to differ now that `create-eigen-game` has left the `fixed` group, and
// asserting against the scaffolder's own version would quietly stop testing
// anything the first time they do.
const expectedEngineRange = `^${(JSON.parse(readFileSync(resolve(import.meta.dirname, "../../server/package.json"), "utf8")) as { version: string }).version}`;

describe("scaffoldGame", () => {
  it("renders the canonical templates as a combined repository", () => {
    const root = resolve(temporaryParent(), "my-game");

    scaffoldGame({ directory: root, bootstrap: false, packageManager: "npm" });

    const manifest = JSON.parse(readFileSync(resolve(root, "server/package.json"), "utf8"));
    expect(manifest.name).toBe("@game/my-game-server");
    expect(manifest.dependencies["@eigeninteractive/server"]).toBe(expectedEngineRange);
    expect(manifest.dependencies["@eigeninteractive/rules"]).toBe(expectedEngineRange);
    expect(manifest.devDependencies["@eigeninteractive/testkit"]).toBe(expectedEngineRange);
    expect(manifest.eigen).toEqual({ game: "My Game" });
    expect(manifest.scripts.contract).toBe("eigen-contract");
    expect(manifest.scripts["contract:check"]).toBe("eigen-contract --check");
    expect(manifest.scripts.test).toBe("vitest run");
    expect(manifest.scripts["test:watch"]).toBe("vitest");
    expect(manifest.scripts.typecheck).toContain("wrangler types");

    const worker = readFileSync(resolve(root, "server/src/index.ts"), "utf8");
    const wrangler = readFileSync(resolve(root, "server/wrangler.jsonc"), "utf8");
    expect(worker).toContain("class GameDO extends BaseGameDO<Env>");
    expect(worker).toContain("env.GAME_DB");
    expect(worker).not.toContain("clientOrigins:");
    expect(worker).not.toContain("interface Env");
    expect(wrangler).toContain('"binding": "GAME_DB"');
    expect(wrangler).toContain('"WEB_APP_ORIGIN": "http://localhost:7357"');
    expect(wrangler).toContain('"binding": "ASSETS"');
    expect(wrangler).toContain('"not_found_handling": "single-page-application"');
    expect(wrangler).toContain('"/download"');
    expect(wrangler).not.toContain("database_id");

    expect(readFileSync(resolve(root, "server/src/module/index.ts"), "utf8")).toContain("export default { versions:");
    expect(readFileSync(resolve(root, "app/lib/game/module.dart"), "utf8")).toContain("class MyGameModule");
    expect(readFileSync(resolve(root, "app/lib/game/v1/rules.dart"), "utf8")).toContain("extends MyGameV1RulesBase");
    const dartTwinTest = readFileSync(resolve(root, "app/test/game/twin_fixtures_test.dart"), "utf8");
    expect(dartTwinTest).toContain("package:my_game/game/module.dart");
    expect(dartTwinTest).toContain("const module = MyGameModule()");
    expect(readFileSync(resolve(root, "server/test/twin.spec.ts"), "utf8")).toContain("twinFixtureTests");
    expect(readFileSync(resolve(root, "server/src/module/fixtures/v1/counter.json"), "utf8")).toContain('"schemaVersion": 1');
    expect(readFileSync(resolve(root, "app/lib/game/README.md"), "utf8")).toContain("eigen_flutter:generate_payloads");
    const bootstrap = readFileSync(resolve(root, "app/web/flutter_bootstrap.js"), "utf8");
    expect(bootstrap).toContain("firebase-messaging-sw.js");
    expect(bootstrap).not.toContain("cdnjs.cloudflare.com");
    expect(readFileSync(resolve(root, "app/web/index.html"), "utf8")).not.toContain("cropper");
    expect(existsSync(resolve(root, "app/web/vendor/cropperjs"))).toBe(false);
    const messagingWorker = readFileSync(resolve(root, "app/web/firebase-messaging-sw.js"), "utf8");
    expect(messagingWorker).toContain('importScripts("firebase-config.js")');
    expect(messagingWorker).toContain("firebase.initializeApp(self.firebaseConfig)");
    expect(messagingWorker).toContain("firebase.messaging()");
    expect(messagingWorker).not.toContain("REPLACE_ME");
    expect(readFileSync(resolve(root, "app/web/firebase-config.js"), "utf8")).toContain("firebase:configure");
    const firebaseOptions = readFileSync(resolve(root, "app/lib/firebase_options.dart"), "utf8");
    expect(firebaseOptions).toContain("class DefaultFirebaseOptions");
    expect(firebaseOptions).toContain("Firebase is not configured");
    const appMain = readFileSync(resolve(root, "app/lib/main.dart"), "utf8");
    expect(appMain).toContain("DefaultFirebaseOptions.currentPlatform");
    expect(appMain).not.toContain("REPLACE_ME");
    const appConfig = readFileSync(resolve(root, "app/app-config.json"), "utf8");
    expect(appConfig).toContain('"API_BASE_URL": ""');
    expect(appConfig).toContain('"APP_HOST": ""');
    expect(existsSync(resolve(root, "app/web-config.json"))).toBe(false);
    expect(readFileSync(resolve(root, "README.md"), "utf8")).toContain("npm run contract");
    const rootGitignore = readFileSync(resolve(root, ".gitignore"), "utf8");
    expect(rootGitignore).toContain("server/node_modules/");
    expect(rootGitignore).toContain("!server/.dev.vars.example");
    expect(rootGitignore).toContain("server/public/*");
    expect(rootGitignore).toContain("!server/public/.gitkeep");
    // pnpm fails the install outright when a dependency's build scripts are
    // skipped, so a generated project that does not name these cannot be
    // installed at all with pnpm.
    const pnpmSettings = readFileSync(resolve(root, "server/pnpm-workspace.yaml"), "utf8");
    expect(pnpmSettings).toContain("allowBuilds:");
    expect(pnpmSettings).toContain("esbuild: true");
    expect(pnpmSettings).toContain("workerd: true");

    const devVars = readFileSync(resolve(root, "server/.dev.vars.example"), "utf8");
    expect(devVars).not.toContain("FIREBASE_PROJECT_ID=");
    expect(devVars).not.toContain("WEB_APP_ORIGIN=");
    expect(devVars).toContain("FIREBASE_PRIVATE_KEY=");

    // Native release plumbing — rendered unconditionally by the app-overlay
    // tree, so present even with `bootstrap: false` (unlike the Gradle/pubspec
    // appends below, which need a real `flutter create` output to edit).
    expect(readFileSync(resolve(root, "app/fastlane/Appfile"), "utf8")).toContain('package_name("com.example.my_game")');
    expect(readFileSync(resolve(root, "app/fastlane/Fastfile"), "utf8")).toContain("upload_to_play_store");
    expect(readFileSync(resolve(root, "app/Gemfile"), "utf8")).toContain("fastlane");
    expect(readFileSync(resolve(root, "app/.ruby-version"), "utf8").trim()).not.toBe("");
    expect(readFileSync(resolve(root, "app/.fvmrc"), "utf8")).toContain("3.44.8");
    expect(readFileSync(resolve(root, "app/android/app/proguard-rules.pro"), "utf8")).toContain("image_cropper");
    expect(readFileSync(resolve(root, "app/CHANGELOG.md"), "utf8")).toContain("[Unreleased]");
    expect(readFileSync(resolve(root, ".nvmrc"), "utf8").trim()).toBe("24");

    // Binary templates must arrive byte-identical. They did not: renderTree
    // read every file as UTF-8 and wrote it back, so any byte that is not
    // valid UTF-8 became U+FFFD. A 1024px PNG grew by tens of kilobytes of
    // replacement characters and stopped decoding — `flutter_launcher_icons`
    // failed with NoDecoderForImageFormatException. Compare the bytes, not
    // just the length, and not merely "the file exists".
    for (const asset of ["icon.png", "icon_foreground.png", "splash.png", "splash_dark.png"]) {
      expect(readFileSync(resolve(root, `app/assets/icon/${asset}`))).toEqual(readFileSync(resolve(import.meta.dirname, `../templates/app-overlay/assets/icon/${asset}`)));
    }

    // The notification icon is deliberately NOT here: `eigen_flutter`'s
    // Android plugin ships `ic_notification` and the Firebase meta-data
    // pointing at it, so the scaffold neither writes the drawable nor edits
    // the app manifest. A game overrides it by declaring the same resource
    // name, which Android resource merging resolves in the app's favour.
    expect(existsSync(resolve(root, "app/android/app/src/main/res/drawable/ic_notification.xml"))).toBe(false);

    // CI is opt-in, so a default scaffold has no workflows at all.
    expect(existsSync(resolve(root, ".github/workflows"))).toBe(false);

    const rootManifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(rootManifest.name).toBe("my-game");
    expect(rootManifest.private).toBe(true);
    expect(rootManifest.scripts.contract).toContain("cd server && npm run contract");
    expect(rootManifest.scripts.contract).toContain("cd ../app && dart run eigen_flutter:generate_payloads");
    expect(rootManifest.scripts.contract).toContain("--fixtures-output test/fixtures");
    expect(rootManifest.scripts["contract:check"]).toContain("npm run contract:check");
    expect(rootManifest.scripts["contract:check"]).toMatch(/--check$/);
    expect(rootManifest.scripts["build:android"]).toContain("--dart-define-from-file=app-config.json");
    expect(rootManifest.scripts["build:web"]).toContain("--output ../server/public");
    expect(rootManifest.scripts["build:web"]).toContain("--dart-define-from-file=app-config.json");
    expect(rootManifest.scripts.deploy).toContain("run build:web");
    expect(rootManifest.scripts["firebase:configure"]).toBe("cd app && dart run eigen_flutter:configure_firebase");
  });

  it("uses ecosystem CLIs to bootstrap both halves", () => {
    const parent = temporaryParent();
    const root = resolve(parent, "chess");
    const run = vi.fn((command: string, args: string[]) => {
      if (command === "flutter" && args[0] === "create") {
        const app = args.at(-1);
        if (app) {
          mkdirSync(resolve(app, "android/app"), { recursive: true });
          writeFileSync(resolve(app, "pubspec.yaml"), "name: chess\ndependencies:\n  flutter:\n    sdk: flutter\n");
          writeFileSync(resolve(app, "android/app/build.gradle.kts"), 'plugins {\n    id("com.android.application")\n}\n');
        }
      }
    });

    scaffoldGame({ directory: root, packageManager: "pnpm", org: "games.example", run });

    expect(run).toHaveBeenCalledWith("flutter", expect.arrayContaining(["create", "--empty", "--platforms", "android,web", "--project-name", "chess", "--org", "games.example"]), expect.any(String));
    // A caret range, not an exact version: `pub add` then takes the newest
    // release on that line, which is the part a scaffold-time pub.dev lookup
    // was duplicating. Crossing to the next line is the move that needs the
    // `scaffold` CI job to confirm the templates still compile.
    expect(run).toHaveBeenCalledWith("flutter", ["pub", "add", "eigen_flutter@^0.3.0", "firebase_core@^4.9.0", "firebase_messaging@^16.2.2"], expect.stringMatching(/\/app$/));
    // A separate `pub add` (rather than folded into the call above) so a
    // failure here is legible on its own, and because these are dev
    // dependencies (`dev:` prefix) while the engine/Firebase packages above
    // are not.
    expect(run).toHaveBeenCalledWith("flutter", ["pub", "add", "dev:flutter_launcher_icons", "dev:flutter_native_splash"], expect.stringMatching(/\/app$/));
    // Configuring the icon tools is not enough — both write committed files,
    // so they have to actually run or the app ships Flutter's own blue logo.
    expect(run).toHaveBeenCalledWith("dart", ["run", "flutter_launcher_icons"], expect.stringMatching(/\/app$/));
    expect(run).toHaveBeenCalledWith("dart", ["run", "flutter_native_splash:create"], expect.stringMatching(/\/app$/));
    expect(run).toHaveBeenCalledWith("pnpm", ["install"], expect.stringMatching(/\/server$/));
    expect(run).toHaveBeenCalledWith("pnpm", ["run", "contract"], expect.stringMatching(/\/server$/));
    expect(run).toHaveBeenCalledWith("dart", expect.arrayContaining(["run", "eigen_flutter:generate_payloads", "--contract", "../server/game-contract.json"]), expect.stringMatching(/\/app$/));
    const androidGradle = readFileSync(resolve(root, "app/android/app/build.gradle.kts"), "utf8");
    expect(androidGradle).toContain("isCoreLibraryDesugaringEnabled = true");
    expect(androidGradle).toContain('coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")');
    expect(androidGradle).toContain("signingConfigs");
    expect(androidGradle).toContain("proguardFiles(");

    expect(readFileSync(resolve(root, "app/fastlane/Appfile"), "utf8")).toContain('package_name("games.example.chess")');

    const appPubspec = readFileSync(resolve(root, "app/pubspec.yaml"), "utf8");
    expect(appPubspec).toContain("flutter_launcher_icons:");
    expect(appPubspec).toContain("flutter_native_splash:");
    // `scaffoldGame` only creates `--platforms android,web` — `ios`/`macos`
    // keys would make `flutter_launcher_icons` error on a platform directory
    // that doesn't exist.
    expect(appPubspec).not.toContain("ios:");
    expect(appPubspec).not.toContain("macos:");
    // The shipped adaptive foreground is the reversed, light-on-dark mark, so
    // the background behind it has to be ink — the previous "#FFFFFF" default
    // would render it invisible.
    expect(appPubspec).toContain('adaptive_icon_background: "#1B1E24"');
    expect(appPubspec).toContain("image_dark: assets/icon/splash_dark.png");

    const rootManifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(rootManifest.scripts.contract).toContain("cd server && pnpm run contract");
  });

  it("makes identifiers safe for a numeric game name", () => {
    const root = resolve(temporaryParent(), "2048");
    scaffoldGame({ directory: root, bootstrap: false });

    expect(readFileSync(resolve(root, "app/lib/game/module.dart"), "utf8")).toContain("class Game2048Module");
    expect(readFileSync(resolve(root, "server/src/module/v1.ts"), "utf8")).toContain('id: "Game2048V1State"');
  });

  it("requires one canonical slug and derives every other name", () => {
    const root = resolve(temporaryParent(), "Not A Slug");

    expect(() => scaffoldGame({ directory: root, bootstrap: false })).toThrow("lowercase kebab-case slug");
    expect(existsSync(root)).toBe(false);
  });

  it("publishes the destination atomically", () => {
    const parent = temporaryParent();
    const root = resolve(parent, "broken");

    expect(() =>
      scaffoldGame({
        directory: root,
        run: () => {
          throw new Error("flutter unavailable");
        },
      }),
    ).toThrow("flutter unavailable");

    expect(existsSync(root)).toBe(false);
    expect(readdirSync(parent)).toEqual([]);
  });
});

describe("repository initialisation", () => {
  // A checked-out CI image has no `user.name` or `user.email`, and these are
  // the identity git reads when the config is silent. Stubbed here so the
  // tests assert the scaffolder's behaviour rather than the runner's git
  // configuration.
  beforeEach(() => {
    vi.stubEnv("GIT_AUTHOR_NAME", "Scaffold Test");
    vi.stubEnv("GIT_AUTHOR_EMAIL", "scaffold@example.com");
    vi.stubEnv("GIT_COMMITTER_NAME", "Scaffold Test");
    vi.stubEnv("GIT_COMMITTER_EMAIL", "scaffold@example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("commits the scaffold, so the first diff is the first game change", () => {
    const root = resolve(temporaryParent(), "go-fish");

    scaffoldGame({ directory: root, bootstrap: false, git: true });

    expect(existsSync(resolve(root, ".git"))).toBe(true);
    expect(execFileSync("git", ["log", "-1", "--format=%s"], { cwd: root, encoding: "utf8" }).trim()).toBe("Scaffold go-fish");
    // Nothing left behind: the generated `.gitignore` files have to cover
    // everything the scaffolder writes, or the commit is not a usable baseline.
    expect(execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" })).toBe("");
  });

  it("stays out of the way inside an existing checkout", () => {
    // A nested repository here is silent breakage rather than clutter: the
    // outer repository records a gitlink and none of the app's files are ever
    // pushed.
    const parent = temporaryParent();
    execFileSync("git", ["init", "--quiet"], { cwd: parent });
    const root = resolve(parent, "go-fish");

    scaffoldGame({ directory: root, bootstrap: false, git: true });

    expect(existsSync(resolve(root, ".git"))).toBe(false);
  });

  it("leaves the project alone when asked not to, and when not bootstrapping", () => {
    const declined = resolve(temporaryParent(), "go-fish");
    scaffoldGame({ directory: declined, bootstrap: false, git: false });
    expect(existsSync(resolve(declined, ".git"))).toBe(false);

    // `bootstrap: false` is the programmatic seam, and its default follows:
    // a repository of half a project is not worth committing.
    const unbootstrapped = resolve(temporaryParent(), "go-fish");
    scaffoldGame({ directory: unbootstrapped, bootstrap: false });
    expect(existsSync(resolve(unbootstrapped, ".git"))).toBe(false);
  });

  it("keeps a scaffold that git could not commit", () => {
    const root = resolve(temporaryParent(), "go-fish");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    scaffoldGame({
      directory: root,
      bootstrap: false,
      git: true,
      run: (command) => {
        if (command === "git") throw new Error("git: command not found");
      },
    });

    // The project cost two minutes of Flutter and pub to produce. A missing
    // `git`, or the unconfigured `user.email` of a fresh CI image, is not a
    // reason to discard it.
    expect(existsSync(resolve(root, "server/package.json"))).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("git init"));
    warn.mockRestore();
  });
});

describe("template rendering", () => {
  it("pins which files are copied verbatim rather than rendered", () => {
    // The rule — "render it if it decodes as UTF-8" — is otherwise invisible,
    // which is how the old traversal mangled every binary for so long without
    // anyone noticing. This states the outcome for the whole tree, so adding
    // an asset that lands on the copy-verbatim side shows up as a diff to
    // approve instead of a silent behaviour change.
    const templates = resolve(import.meta.dirname, "../templates");
    const walk = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory() ? walk(path) : entry.isFile() ? [relative(templates, path)] : [];
      });

    const verbatim = walk(templates)
      .filter((file) => decodeUtf8(readFileSync(resolve(templates, file))) === undefined)
      .sort();

    expect(verbatim).toEqual(["app-overlay/assets/icon/icon.png", "app-overlay/assets/icon/icon_foreground.png", "app-overlay/assets/icon/splash.png", "app-overlay/assets/icon/splash_dark.png"]);
  });

  it("substitutes tokens in text that carries no file extension", () => {
    const root = resolve(temporaryParent(), "my-game");

    scaffoldGame({ directory: root, bootstrap: false, packageManager: "npm" });

    // Gemfile and Fastfile are the reason this is not an extension allowlist:
    // they need rendering and have no extension to key one off.
    expect(readFileSync(resolve(root, "app/fastlane/Fastfile"), "utf8")).not.toContain("example-game");
    expect(readFileSync(resolve(root, "app/Gemfile"), "utf8")).toContain("fastlane");
  });
});

describe("continuous integration", () => {
  const workflows = [".github/workflows/checks.yml", ".github/workflows/release.yml"];

  it("emits the workflows when asked for at scaffold time", () => {
    const root = resolve(temporaryParent(), "my-game");

    scaffoldGame({ directory: root, bootstrap: false, packageManager: "npm", ci: true });

    const checks = readFileSync(resolve(root, workflows[0]), "utf8");
    expect(checks).toContain("workflow_call");
    // The gate must stay runnable by a fork PR, which is only true while it
    // references no secrets at all.
    expect(checks).not.toContain("secrets.");
    expect(checks).toContain("npm install");
    const release = readFileSync(resolve(root, workflows[1]), "utf8");
    expect(release).toContain("uses: ./.github/workflows/checks.yml");
    expect(release).toContain("environment: play-store");
  });

  it("adds them to an existing project later, with the manager it was scaffolded with", () => {
    const root = resolve(temporaryParent(), "my-game");
    scaffoldGame({ directory: root, bootstrap: false, packageManager: "pnpm" });
    expect(existsSync(resolve(root, ".github"))).toBe(false);

    const result = addContinuousIntegration({ directory: root });

    expect(result.files).toEqual(workflows);
    // Read back from the project rather than passed in — a project scaffolded
    // with pnpm must not silently gain npm workflows.
    expect(readFileSync(resolve(root, workflows[0]), "utf8")).toContain("pnpm install");
  });

  it("refuses to clobber workflows that already exist", () => {
    const root = resolve(temporaryParent(), "my-game");
    scaffoldGame({ directory: root, bootstrap: false, ci: true });

    expect(() => addContinuousIntegration({ directory: root })).toThrow(/refusing to overwrite/);
  });

  it("rejects a directory that is not a generated project", () => {
    const parent = temporaryParent();

    expect(() => addContinuousIntegration({ directory: parent })).toThrow(/not an EigenInteractive game project/);
  });
});

describe("detectPackageManager", () => {
  it("detects npm and pnpm user agents", () => {
    expect(detectPackageManager("npm/12.0.1 node/v26.5.0")).toBe("npm");
    expect(detectPackageManager("pnpm/11.13.0 npm/? node/v26.5.0")).toBe("pnpm");
    expect(detectPackageManager("yarn/4.0.0")).toBeUndefined();
  });
});

describe("canonical Worker template", () => {
  it("commits the contract emitted by its schemas and fixtures", () => {
    const workerRoot = resolve(import.meta.dirname, "../templates/worker");
    const contract = buildGameContract({
      game: "Example Game",
      gameModule,
      fixturesRoot: resolve(workerRoot, "src/module/fixtures"),
    });

    expect(`${JSON.stringify(contract, null, 2)}\n`).toBe(readFileSync(resolve(workerRoot, "game-contract.json"), "utf8"));
  });
});
