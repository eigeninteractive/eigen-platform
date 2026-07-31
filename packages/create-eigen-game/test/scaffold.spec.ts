import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { buildGameContract } from "@eigeninteractive/testkit";
import { describe, expect, it, vi } from "vitest";
import { detectPackageManager, scaffoldGame } from "../src/index.js";
import gameModule from "../templates/worker/src/module/index.js";

const temporaryParent = (): string => mkdtempSync(resolve(tmpdir(), "create-eigen-game-"));

describe("scaffoldGame", () => {
  it("renders the canonical templates as a combined repository", () => {
    const root = resolve(temporaryParent(), "my-game");

    scaffoldGame({ directory: root, bootstrap: false, packageManager: "npm" });

    const manifest = JSON.parse(readFileSync(resolve(root, "server/package.json"), "utf8"));
    expect(manifest.name).toBe("@game/my-game-server");
    expect(manifest.dependencies["@eigeninteractive/server"]).toBe("^0.1.0");
    expect(manifest.dependencies["@eigeninteractive/rules"]).toBe("^0.1.0");
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
    expect(readFileSync(resolve(root, "app/web/firebase-messaging-sw.js"), "utf8")).toContain("firebase.messaging()");
    expect(readFileSync(resolve(root, "app/web-config.json"), "utf8")).toContain('"APP_HOST": "REPLACE_ME.example.com"');
    expect(readFileSync(resolve(root, "README.md"), "utf8")).toContain("npm run contract");
    const rootGitignore = readFileSync(resolve(root, ".gitignore"), "utf8");
    expect(rootGitignore).toContain("server/node_modules/");
    expect(rootGitignore).toContain("!server/.dev.vars.example");
    expect(rootGitignore).toContain("server/public/*");
    expect(rootGitignore).toContain("!server/public/.gitkeep");
    const devVars = readFileSync(resolve(root, "server/.dev.vars.example"), "utf8");
    expect(devVars).not.toContain("FIREBASE_PROJECT_ID=");
    expect(devVars).not.toContain("WEB_APP_ORIGIN=");
    expect(devVars).toContain("FIREBASE_PRIVATE_KEY=");

    const rootManifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(rootManifest.name).toBe("my-game");
    expect(rootManifest.private).toBe(true);
    expect(rootManifest.scripts.contract).toContain("cd server && npm run contract");
    expect(rootManifest.scripts.contract).toContain("cd ../app && dart run eigen_flutter:generate_payloads");
    expect(rootManifest.scripts.contract).toContain("--fixtures-output test/fixtures");
    expect(rootManifest.scripts["contract:check"]).toContain("npm run contract:check");
    expect(rootManifest.scripts["contract:check"]).toMatch(/--check$/);
    expect(rootManifest.scripts["build:web"]).toContain("--output ../server/public");
    expect(rootManifest.scripts.deploy).toContain("run build:web");
  });

  it("uses ecosystem CLIs to bootstrap both halves", () => {
    const parent = temporaryParent();
    const root = resolve(parent, "chess");
    const run = vi.fn((command: string, args: string[]) => {
      if (command === "flutter" && args[0] === "create") {
        const app = args.at(-1);
        if (app) {
          mkdirSync(app, { recursive: true });
          writeFileSync(resolve(app, "pubspec.yaml"), "name: chess\ndependencies:\n  flutter:\n    sdk: flutter\n");
        }
      }
    });

    scaffoldGame({ directory: root, packageManager: "pnpm", org: "games.example", run });

    expect(run).toHaveBeenCalledWith("flutter", expect.arrayContaining(["create", "--empty", "--platforms", "android,web", "--project-name", "chess", "--org", "games.example"]), expect.any(String));
    expect(run).toHaveBeenCalledWith("flutter", ["pub", "add", "eigen_flutter@^0.1.0", "firebase_core@^4.9.0", "firebase_messaging@^16.2.2"], expect.stringMatching(/\/app$/));
    expect(run).toHaveBeenCalledWith("pnpm", ["install"], expect.stringMatching(/\/server$/));
    expect(run).toHaveBeenCalledWith("pnpm", ["run", "contract"], expect.stringMatching(/\/server$/));
    expect(run).toHaveBeenCalledWith("dart", expect.arrayContaining(["run", "eigen_flutter:generate_payloads", "--contract", "../server/game-contract.json"]), expect.stringMatching(/\/app$/));

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
