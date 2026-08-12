import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";
import { buildGameContract } from "@eigeninteractive/testkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addContinuousIntegration, capturingRunner, decodeUtf8, destinationProblem, detectPackageManager, firebaseReadiness, insideWorkTree, normaliseTerminalWidth, type Probe, type Reporter, scaffoldGame } from "../src/index.js";
import gameModule from "../templates/worker/src/module/index.js";

const temporaryParent = (): string => mkdtempSync(resolve(tmpdir(), "create-eigen-game-"));

// Read from the engine package rather than written as a literal, because that
// is the invariant under test: the scaffolder emits the version of the engine
// its templates were compiled against. A literal would need editing on every
// release, and would pass while the template silently pinned the previous one.
//
// Note this is the ENGINE's version, no longer the scaffolder's. The two are
// free to differ now that `create-eigen-game` has left the `fixed` group, and
// asserting against the scaffolder's own version would quietly stop testing
// anything the first time they do.
const expectedEngineRange = `^${(JSON.parse(readFileSync(resolve(import.meta.dirname, "../../server/package.json"), "utf8")) as { version: string }).version}`;

describe("scaffoldGame", () => {
  it("scaffolds into a directory that exists but is empty", () => {
    const root = resolve(temporaryParent(), "my-game");
    mkdirSync(root);

    scaffoldGame({ directory: root, bootstrap: false, packageManager: "npm" });

    expect(existsSync(resolve(root, "server/package.json"))).toBe(true);
  });

  it("refuses a directory with anything in it, and leaves it exactly as it was", () => {
    const root = resolve(temporaryParent(), "my-game");
    mkdirSync(root);
    writeFileSync(resolve(root, "notes.txt"), "mine");

    expect(() => scaffoldGame({ directory: root, bootstrap: false, packageManager: "npm" })).toThrow(/already exists, and is not empty/);
    // The refusal is the whole feature: nothing here is worth less than a
    // scaffold, and only the person who can see it knows that.
    expect(readdirSync(root)).toEqual(["notes.txt"]);
    expect(readFileSync(resolve(root, "notes.txt"), "utf8")).toBe("mine");
  });

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
    // Pointed at the local Worker, so `pnpm dev` and `flutter run` agree with
    // no editing. The two that stay empty cannot be defaulted: one is the
    // deployed hostname, the other comes from the Firebase console.
    expect(appConfig).toContain('"API_BASE_URL": "http://localhost:8787"');
    expect(appConfig).toContain('"APP_HOST": ""');
    expect(appConfig).toContain('"FIREBASE_VAPID_KEY": ""');
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

    // Native release plumbing, rendered unconditionally by the app-overlay
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
    // replacement characters and stopped decoding, so `flutter_launcher_icons`
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
    // `--worker` is what lets a re-run fill in the Worker's FIREBASE_PROJECT_ID,
    // so the command a project keeps does exactly what scaffolding did.
    expect(rootManifest.scripts["firebase:configure"]).toBe("cd app && dart run eigen_flutter:configure_firebase --worker ../server");
  });

  it("uses ecosystem CLIs to bootstrap both halves", () => {
    const parent = temporaryParent();
    const root = resolve(parent, "chess");
    const run = vi.fn((command: string, args: string[], _cwd: string) => {
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
    expect(run).toHaveBeenCalledWith("flutter", ["pub", "add", "eigen_flutter@^0.4.1", "firebase_core@^4.9.0", "firebase_messaging@^16.2.2"], expect.stringMatching(/\/app$/));
    // A separate `pub add` (rather than folded into the call above) so a
    // failure here is legible on its own, and because these are dev
    // dependencies (`dev:` prefix) while the engine/Firebase packages above
    // are not.
    expect(run).toHaveBeenCalledWith("flutter", ["pub", "add", "dev:flutter_launcher_icons", "dev:flutter_native_splash"], expect.stringMatching(/\/app$/));
    // Configuring the icon tools is not enough: both write committed files,
    // so they have to actually run or the app ships Flutter's own blue logo.
    expect(run).toHaveBeenCalledWith("dart", ["run", "flutter_launcher_icons"], expect.stringMatching(/\/app$/));
    expect(run).toHaveBeenCalledWith("dart", ["run", "flutter_native_splash:create"], expect.stringMatching(/\/app$/));
    expect(run).toHaveBeenCalledWith("pnpm", ["install"], expect.stringMatching(/\/server$/));
    // Regenerated against the wrangler the install above resolved, not the one
    // the committed template was generated with, or else `wrangler dev`
    // opens by reporting types that are only stale in their workerd stamp.
    expect(run).toHaveBeenCalledWith("pnpm", ["run", "cf-typegen"], expect.stringMatching(/\/server$/));
    // The root install is Biome's, and is what makes `pnpm lint` work from the
    // directory an implementor is standing in.
    expect(run).toHaveBeenCalledWith("pnpm", ["install"], expect.not.stringMatching(/\/(server|app)$/));
    // The order is the point, not just the presence: typegen reads the
    // wrangler in `server/node_modules`, so it is meaningless before install.
    const serverCalls = run.mock.calls.filter(([, , cwd]) => /\/server$/.test(cwd));
    expect(serverCalls.findIndex(([, args]) => args[1] === "cf-typegen")).toBeGreaterThan(serverCalls.findIndex(([, args]) => args[0] === "install"));
    expect(run).toHaveBeenCalledWith("pnpm", ["run", "contract"], expect.stringMatching(/\/server$/));
    expect(run).toHaveBeenCalledWith("dart", expect.arrayContaining(["run", "eigen_flutter:generate_payloads", "--contract", "../server/game-contract.json"]), expect.stringMatching(/\/app$/));
    const androidGradle = readFileSync(resolve(root, "app/android/app/build.gradle.kts"), "utf8");
    expect(androidGradle).toContain("isCoreLibraryDesugaringEnabled = true");
    expect(androidGradle).toContain('coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")');
    expect(androidGradle).toContain("signingConfigs");
    expect(androidGradle).toContain("proguardFiles(");
    // Each appended block is separated from what it follows by exactly one blank
    // line, including from the other block this scaffolder appends to the same
    // file. Newline normalisation used to be written per call site with two
    // different answers, so the second Gradle block landed flush against the
    // first in every generated project. This is generated code someone reads.
    expect(androidGradle).toContain("}\n\n// flutter_local_notifications requires desugaring");
    expect(androidGradle).toContain("}\n\nval releaseKeyProperties");
    expect(androidGradle).not.toMatch(/\n\n\n/);
    expect(androidGradle.endsWith("}\n")).toBe(true);

    expect(readFileSync(resolve(root, "app/fastlane/Appfile"), "utf8")).toContain('package_name("games.example.chess")');

    const appPubspec = readFileSync(resolve(root, "app/pubspec.yaml"), "utf8");
    expect(appPubspec).toContain("flutter_launcher_icons:");
    expect(appPubspec).toContain("flutter_native_splash:");
    // Same separation rule as the Gradle appends above, and here it is load
    // bearing rather than cosmetic: these are top-level YAML keys, so a block
    // that landed without its own line break would be read as part of whatever
    // `flutter create` wrote last.
    expect(appPubspec).toContain("sdk: flutter\n\nflutter_launcher_icons:");
    expect(appPubspec.endsWith("  web: true\n")).toBe(true);
    // `scaffoldGame` only creates `--platforms android,web`, so `ios`/`macos`
    // keys would make `flutter_launcher_icons` error on a platform directory
    // that doesn't exist.
    expect(appPubspec).not.toContain("ios:");
    expect(appPubspec).not.toContain("macos:");
    // The shipped adaptive foreground is the reversed, light-on-dark mark, so
    // the background behind it has to be ink; the previous "#FFFFFF" default
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

describe("reporting", () => {
  /** A reporter that records the shape of a run rather than drawing it. */
  const recorder = () => {
    const steps: string[] = [];
    const output: string[] = [];
    const warnings: string[] = [];
    let interactive = false;
    const reporter: Reporter = {
      step(label, body) {
        steps.push(label);
        return body();
      },
      handOver(label, body) {
        steps.push(`${label} (interactive)`);
        interactive = true;
        try {
          return body();
        } finally {
          interactive = false;
        }
      },
      emit: (chunk) => output.push(chunk),
      warn: (message) => warnings.push(message),
      get interactive() {
        return interactive;
      },
    };
    return { reporter, steps, output, warnings };
  };

  it("names every step it runs, in order", () => {
    const { reporter, steps } = recorder();

    scaffoldGame({
      directory: resolve(temporaryParent(), "go-fish"),
      bootstrap: false,
      git: false,
      firebase: true,
      reporter,
      run: () => {},
    });

    // The interactive one is the whole reason the seam distinguishes them:
    // FlutterFire asks which project to use, so its output cannot be captured.
    expect(steps).toEqual(["Preparing the Firebase configurator", "Configuring Firebase (interactive)"]);
  });

  it("routes survivable failures to the reporter rather than the console", () => {
    const { reporter, warnings } = recorder();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    scaffoldGame({
      directory: resolve(temporaryParent(), "go-fish"),
      bootstrap: false,
      git: false,
      firebase: true,
      reporter,
      run: (command) => {
        if (command === "dart") throw new Error("flutterfire: command not found");
      },
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("firebase:configure");
    // Otherwise it lands in the middle of the CLI's own output, breaking it.
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("captures a step's output, and hands it over when the step prompts", () => {
    const { reporter, output } = recorder();
    const run = capturingRunner(reporter);
    const root = temporaryParent();

    reporter.step("quiet", () => run("node", ["-e", "console.log('resolved 179 packages')"], root));
    expect(output.join("")).toContain("resolved 179 packages");

    // Inherited instead, so nothing is captured to report.
    output.length = 0;
    reporter.handOver("loud", () => run("node", ["-e", "console.log('')"], root));
    expect(output).toEqual([]);
  });

  it("keeps what a failing step said, on both streams", () => {
    const { reporter, output } = recorder();
    const run = capturingRunner(reporter);

    expect(() => reporter.step("failing", () => run("node", ["-e", "console.log('partial work'); console.error('the actual reason'); process.exit(1)"], temporaryParent()))).toThrow();

    // The one time the output is worth having. pub explains itself on stdout
    // and Gradle on stderr, so neither can be the one that is kept.
    expect(output.join("")).toContain("partial work");
    expect(output.join("")).toContain("the actual reason");
  });
});

describe("normaliseTerminalWidth", () => {
  it("gives a width to a terminal that reports none", () => {
    // The crash this exists for: clack defaults to 80 for a stream with no
    // `columns`, but a pty reporting 0 satisfies its `typeof === number` check,
    // so the box rule is drawn from a negative width and the scaffold dies
    // partway through with `RangeError: Invalid string length`.
    const stream = { isTTY: true, columns: 0 };
    normaliseTerminalWidth(stream);
    expect(stream.columns).toBe(80);

    const absent: { isTTY?: boolean; columns?: number } = { isTTY: true };
    normaliseTerminalWidth(absent);
    expect(absent.columns).toBe(80);
  });

  it("leaves a real width, and anything that is not a terminal, alone", () => {
    const narrow = { isTTY: true, columns: 40 };
    normaliseTerminalWidth(narrow);
    expect(narrow.columns).toBe(40);

    // A pipe has no drawing to size, and clack declines to draw into one.
    const pipe: { isTTY?: boolean; columns?: number } = { isTTY: false };
    normaliseTerminalWidth(pipe);
    expect(pipe.columns).toBeUndefined();
  });
});

describe("firebaseReadiness", () => {
  /** A machine with both CLIs and one signed-in account, minus whatever `absent` names. */
  const machine = (absent?: string | string[], accounts = '{"status":"success","result":[{"user":{"email":"tester@example.com"}}]}'): Probe => {
    const gone = new Set(typeof absent === "string" ? [absent] : (absent ?? []));
    return (command, args) => {
      if (gone.has(command)) return { ok: false, stdout: "" };
      if (args[0] === "login:list") return { ok: true, stdout: accounts };
      return { ok: true, stdout: "1.0.0" };
    };
  };

  /** What is wrong, without the fixes, which is what most of these are about. */
  const reasons = (probe: Probe): string[] => {
    const readiness = firebaseReadiness(probe);
    return readiness.ready ? [] : readiness.problems.map((problem) => problem.reason);
  };

  it("passes a machine that has both tools and a signed-in account", () => {
    expect(firebaseReadiness(machine())).toEqual({ ready: true });
  });

  it("names the missing tool and the command that installs it", () => {
    // Asked here rather than left to `configure_firebase`, which runs at the
    // far end of two minutes of Flutter and pub.
    expect(firebaseReadiness(machine("flutterfire"))).toEqual({ ready: false, problems: [{ reason: "the `flutterfire` CLI is not installed", fix: "dart pub global activate flutterfire_cli" }] });
    expect(firebaseReadiness(machine("firebase"))).toEqual({ ready: false, problems: [{ reason: "the `firebase` CLI is not installed", fix: "curl -sL https://firebase.tools | bash" }] });
  });

  it("catches a machine that has the tools but is signed out", () => {
    expect(firebaseReadiness(machine(undefined, '{"status":"success","result":[]}'))).toEqual({ ready: false, problems: [{ reason: "no Google account is signed in to the Firebase CLI", fix: "firebase login" }] });
  });

  it("reports every problem at once, in the order they have to be fixed in", () => {
    // The point of collecting rather than short-circuiting: a machine with
    // neither CLI would otherwise learn about `flutterfire` only after
    // installing `firebase-tools` and running the whole thing again.
    expect(reasons(machine(["firebase", "flutterfire"]))).toEqual(["the `firebase` CLI is not installed", "the `flutterfire` CLI is not installed"]);
    expect(reasons(machine("flutterfire", '{"status":"success","result":[]}'))).toEqual(["no Google account is signed in to the Firebase CLI", "the `flutterfire` CLI is not installed"]);
  });

  it("says nothing about the sign-in when the CLI that would answer is missing", () => {
    // `login:list` cannot be run, so there is no evidence either way, and
    // installing firebase-tools leads to `firebase login` regardless.
    expect(reasons(machine("firebase", '{"status":"success","result":[]}'))).toEqual(["the `firebase` CLI is not installed"]);
  });

  it("treats an answer it cannot read as no answer", () => {
    // Fails open, as the same check does in `configure_firebase`: a `firebase`
    // whose output grows a different shape must not stop a scaffold on a
    // machine that is perfectly well signed in.
    expect(firebaseReadiness(machine(undefined, "not json at all"))).toEqual({ ready: true });
    expect(firebaseReadiness(machine(undefined, '{"status":"success"}'))).toEqual({ ready: true });
  });
});

describe("destinationProblem", () => {
  it("has nothing to say about a destination that does not exist", () => {
    expect(destinationProblem(resolve(temporaryParent(), "my-game"))).toBeUndefined();
  });

  it("treats an existing but empty directory as free", () => {
    // Made out of habit, or left by cloning a repository with no first commit
    // in it. Refusing over nothing would be its own papercut.
    const root = resolve(temporaryParent(), "my-game");
    mkdirSync(root);

    expect(destinationProblem(root)).toBeUndefined();
  });

  it("names what is in the way rather than saying it is not empty", () => {
    const root = resolve(temporaryParent(), "my-game");
    mkdirSync(root);
    for (const entry of ["README.md", "app", "server", "notes.txt"]) writeFileSync(resolve(root, entry), "");

    const problem = destinationProblem(root);

    // Three of them, because that usually settles whether this was a mistyped
    // path or a directory that has already been scaffolded once, where "not
    // empty" only invites an `ls`.
    expect(problem).toContain("README.md, app, notes.txt");
    expect(problem).toContain("and 1 more");
    // No offer to delete it: this run would write ninety files and call
    // `flutter create`, and the answer being wrong against a mistyped path
    // costs more than any other question here.
    expect(problem).toContain("will not delete a directory you already had");
  });

  it("catches a destination that is a file", () => {
    const root = resolve(temporaryParent(), "my-game");
    writeFileSync(root, "");

    expect(destinationProblem(root)).toContain("is a file");
  });
});

describe("insideWorkTree", () => {
  it("asks the nearest ancestor that exists, since the destination does not yet", () => {
    const parent = temporaryParent();
    const asked: string[][] = [];
    const probe: Probe = (command, args) => {
      asked.push([command, ...args]);
      return { ok: true, stdout: "true\n" };
    };

    expect(insideWorkTree(resolve(parent, "not-created-yet/nor-this"), probe)).toBe(true);
    // `git -C` rather than a cwd, because `Probe` has nowhere to put one, and
    // the directory it names has to be one that already exists.
    expect(asked).toEqual([["git", "-C", parent, "rev-parse", "--is-inside-work-tree"]]);
  });

  it("is false outside a repository", () => {
    expect(insideWorkTree(temporaryParent(), () => ({ ok: false, stdout: "" }))).toBe(false);
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

    // The outcome is asserted alongside each effect because the CLI's closing
    // summary reports from it rather than looking at the tree itself.
    expect(scaffoldGame({ directory: root, bootstrap: false, git: true }).git).toBe("committed");

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

    expect(scaffoldGame({ directory: root, bootstrap: false, git: true }).git).toBe("existing");

    expect(existsSync(resolve(root, ".git"))).toBe(false);
  });

  it("leaves the project alone when asked not to, and when not bootstrapping", () => {
    const declined = resolve(temporaryParent(), "go-fish");
    expect(scaffoldGame({ directory: declined, bootstrap: false, git: false }).git).toBe("skipped");
    expect(existsSync(resolve(declined, ".git"))).toBe(false);

    // `bootstrap: false` is the programmatic seam, and its default follows:
    // a repository of half a project is not worth committing.
    const unbootstrapped = resolve(temporaryParent(), "go-fish");
    expect(scaffoldGame({ directory: unbootstrapped, bootstrap: false }).git).toBe("skipped");
    expect(existsSync(resolve(unbootstrapped, ".git"))).toBe(false);
  });

  // Here rather than with the other template assertions because it needs a
  // commit to be meaningful (an uncommitted tree reports every file) and the
  // committer identity this block stubs is what a CI image does not have.
  it("ignores what a root script leaves behind", () => {
    const root = resolve(temporaryParent(), "my-game");

    scaffoldGame({ directory: root, bootstrap: false, git: true });

    // Installing at the root, which the scaffolder does for Biome, leaves a
    // node_modules/ that must not be committed, beside a lockfile that must.
    mkdirSync(resolve(root, "node_modules"), { recursive: true });
    writeFileSync(resolve(root, "node_modules/.modules.yaml"), "");

    expect(execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" })).toBe("");

    // `check-ignore` answers by exit status. Every lockfile is committed; it is
    // only the installed trees that are ignored, and those are named per path.
    const ignored = (path: string): boolean => {
      try {
        execFileSync("git", ["check-ignore", path], { cwd: root, stdio: "ignore" });
        return true;
      } catch {
        return false;
      }
    };
    expect(ignored("node_modules/.modules.yaml")).toBe(true);
    expect(ignored("server/node_modules/x")).toBe(true);
    expect(ignored("pnpm-lock.yaml")).toBe(false);
    expect(ignored("server/pnpm-lock.yaml")).toBe(false);
    expect(ignored("app/pubspec.lock")).toBe(false);
  });

  it("configures Firebase before the commit, not after it", () => {
    const root = resolve(temporaryParent(), "go-fish");
    const calls: [string, string[], string][] = [];

    const result = scaffoldGame({
      directory: root,
      bootstrap: false,
      git: true,
      firebase: "example-project",
      run: (command, args, cwd) => {
        calls.push([command, args, cwd]);
      },
    });

    expect(result.firebase).toBe("configured");
    // Not the `--help` warm-up ahead of it, which exists only to move `dart
    // run`'s "Building package executable" out of the interactive step.
    const configure = calls.findIndex(([command, args]) => command === "dart" && !args.includes("--help"));
    expect(calls[configure]).toEqual(["dart", ["run", "eigen_flutter:configure_firebase", "--worker", "../server", "--project", "example-project"], resolve(root, "app")]);
    // The whole reason for doing this here: `firebase.json`,
    // `google-services.json`, the generated `firebase_options.dart` and
    // FlutterFire's two Gradle edits are in the scaffold commit rather than
    // being the project's first diff.
    expect(configure).toBeLessThan(calls.findIndex(([command, args]) => command === "git" && args[0] === "init"));
  });

  it("does not make FlutterFire ask about the placeholder it is there to replace", () => {
    const root = resolve(temporaryParent(), "go-fish");
    let placeholderAtRunTime = true;

    const result = scaffoldGame({
      directory: root,
      bootstrap: false,
      git: false,
      firebase: true,
      run: (command, args, cwd) => {
        if (command !== "dart" || args.includes("--help")) return;
        placeholderAtRunTime = existsSync(resolve(cwd, "lib/firebase_options.dart"));
        // Stand in for what FlutterFire writes.
        writeFileSync(resolve(cwd, "lib/firebase_options.dart"), "// generated\n");
      },
    });

    // "Overwrite the file whose only purpose is to be overwritten?" has one
    // right answer, so it is not worth asking.
    expect(placeholderAtRunTime).toBe(false);
    expect(result.firebase).toBe("configured");
    expect(readFileSync(resolve(root, "app/lib/firebase_options.dart"), "utf8")).toBe("// generated\n");
  });

  it("puts the placeholder back when nothing replaced it", () => {
    const root = resolve(temporaryParent(), "go-fish");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    scaffoldGame({
      directory: root,
      bootstrap: false,
      git: false,
      firebase: true,
      run: (command) => {
        if (command === "dart") throw new Error("flutterfire: command not found");
      },
    });

    // Without it the app does not compile, which is worse than the throwing
    // seam it was.
    expect(readFileSync(resolve(root, "app/lib/firebase_options.dart"), "utf8")).toContain("Firebase is not configured");
    expect(existsSync(resolve(root, "app/lib/firebase_options.dart.placeholder"))).toBe(false);
    warn.mockRestore();
  });

  it("keeps what a late failure had already written", () => {
    const root = resolve(temporaryParent(), "go-fish");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    scaffoldGame({
      directory: root,
      bootstrap: false,
      git: false,
      firebase: true,
      run: (command, args, cwd) => {
        if (command !== "dart" || args.includes("--help")) return;
        // FlutterFire writes this, then the service worker configuration is
        // derived from it, so the second half can fail with the first half
        // done, and a real file is worth more than the placeholder.
        writeFileSync(resolve(cwd, "lib/firebase_options.dart"), "// generated\n");
        throw new Error("firebase: HTTP 503");
      },
    });

    expect(readFileSync(resolve(root, "app/lib/firebase_options.dart"), "utf8")).toBe("// generated\n");
    expect(existsSync(resolve(root, "app/lib/firebase_options.dart.placeholder"))).toBe(false);
    warn.mockRestore();
  });

  it("lets FlutterFire ask which project, when none was named", () => {
    const root = resolve(temporaryParent(), "go-fish");
    const calls: string[][] = [];

    scaffoldGame({
      directory: root,
      bootstrap: false,
      git: false,
      firebase: true,
      run: (_command, args) => {
        calls.push(args);
      },
    });

    // Passing no `--project` is what makes FlutterFire prompt, which is also
    // the only route to creating a project from here.
    expect(calls).toContainEqual(["run", "eigen_flutter:configure_firebase", "--worker", "../server"]);
  });

  it("keeps a scaffold that Firebase could not be configured for", () => {
    const root = resolve(temporaryParent(), "go-fish");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = scaffoldGame({
      directory: root,
      bootstrap: false,
      git: true,
      firebase: true,
      run: (command) => {
        if (command === "dart") throw new Error("flutterfire: command not found");
      },
    });

    // A cancelled picker or a missing CLI leaves exactly what a scaffold
    // without `--firebase` produces, so the commit still happens and the
    // summary goes back to naming the step.
    expect(result.firebase).toBe("failed");
    expect(result.git).toBe("committed");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("firebase:configure"));
    warn.mockRestore();
  });

  it("keeps a scaffold that git could not commit", () => {
    const root = resolve(temporaryParent(), "go-fish");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = scaffoldGame({
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
    expect(result.git).toBe("failed");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("git init"));
    warn.mockRestore();
  });
});

describe("template rendering", () => {
  it("pins which files are copied verbatim rather than rendered", () => {
    // The rule, "render it if it decodes as UTF-8", is otherwise invisible,
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

  it("keeps each packaged .gitignore identical to the one it stands in for", () => {
    // npm strips files named `.gitignore` from tarballs, so every tree that
    // ships one keeps a second copy under `scaffold/` that the published
    // scaffolder writes instead. Two copies of the same file drift silently.
    // This one already had, losing `app/pubspec_overrides.yaml` from the
    // Git-rendered side, and only the `scaffold/` copy reaches a real project.
    const templates = resolve(import.meta.dirname, "../templates");
    for (const [tree, packaged] of [
      ["project", "scaffold/project.gitignore"],
      ["worker", "scaffold/worker.gitignore"],
    ]) {
      expect(readFileSync(resolve(templates, tree, ".gitignore"), "utf8"), `${tree}/.gitignore`).toBe(readFileSync(resolve(templates, packaged), "utf8"));
    }
  });

  it("ships the generated Biome config under a name Biome will not load here", () => {
    // Biome refuses to run at all when it finds a nested root configuration:
    // both the CLI and the editor's language server, which fails with an empty
    // error message and simply stops working on the whole repository. A
    // template named `biome.json` is exactly that, and the scaffolder already
    // strips `.template`, so the suffix does double duty.
    const templates = resolve(import.meta.dirname, "../templates");
    const walk = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory() ? walk(path) : [relative(templates, path)];
      });

    expect(walk(templates).filter((file) => /(^|\/)biome\.jsonc?$/.test(file))).toEqual([]);
  });

  it("passes the lint and format rules it ships with", () => {
    const root = resolve(temporaryParent(), "my-game");

    scaffoldGame({ directory: root, bootstrap: false, packageManager: "pnpm" });

    // The point of shipping a biome.json is that the generated files satisfy
    // it. If they do not, the implementor's first `format` rewrites code they
    // did not write, and their first diff is noise.
    //
    // Run from inside the generated project so Biome resolves the config it
    // was given, not this workspace's. They differ, and the generated one is
    // the only one that matters here. The binary comes from this workspace
    // because `bootstrap: false` installs nothing.
    const biome = resolve(import.meta.dirname, "../../../node_modules/.bin/biome");
    expect(() => execFileSync(biome, ["check", "."], { cwd: root, encoding: "utf8", stdio: "pipe" })).not.toThrow();
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
    // Read back from the project rather than passed in: a project scaffolded
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
