import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { GameModule } from "@eigeninteractive/rules";
import { tsImport } from "tsx/esm/api";
import { checkGameContract, emitGameContract } from "./game-contract.js";

interface EigenPackageConfig {
  game?: unknown;
  module?: unknown;
  fixtures?: unknown;
  contract?: unknown;
}

interface PackageManifest {
  eigen?: EigenPackageConfig;
}

function configuredString(value: unknown, fallback: string, field: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`package.json eigen.${field} must be a non-empty string`);
  }
  return value;
}

const isGameModule = (value: unknown): value is GameModule => value !== null && typeof value === "object" && "versions" in value && value.versions !== null && typeof value.versions === "object";

/**
 * Emit a contract from the conventional game package layout.
 *
 * The package default-exports its GameModule from `src/module/index.ts` and
 * declares `{ "eigen": { "game": "…" } }` in package.json. Paths can be
 * overridden under the same `eigen` object.
 */
async function configuredGameContractOptions(root: string) {
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as PackageManifest;
  const config = manifest.eigen ?? {};
  const game = configuredString(config.game, "", "game");
  if (game.length === 0) {
    throw new Error('package.json must declare an Eigen game name, e.g. "eigen": { "game": "Chess" }');
  }

  const modulePath = configuredString(config.module, "src/module/index.ts", "module");
  const fixturesPath = configuredString(config.fixtures, "src/module/fixtures", "fixtures");
  const contractPath = configuredString(config.contract, "game-contract.json", "contract");
  const imported = (await tsImport(pathToFileURL(resolve(root, modulePath)).href, import.meta.url)) as { default?: unknown };

  if (!isGameModule(imported.default)) {
    throw new Error(`${modulePath} must default-export an Eigen GameModule`);
  }

  return {
    game,
    gameModule: imported.default,
    fixturesRoot: resolve(root, fixturesPath),
    output: resolve(root, contractPath),
  };
}

export async function emitConfiguredGameContract(root = process.cwd()): Promise<void> {
  emitGameContract(await configuredGameContractOptions(root));
}

export async function checkConfiguredGameContract(root = process.cwd()): Promise<void> {
  checkGameContract(await configuredGameContractOptions(root));
}
