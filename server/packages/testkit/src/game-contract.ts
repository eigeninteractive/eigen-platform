/**
 * Emit the language-neutral contract a game's Flutter repository consumes.
 *
 * The authoritative inputs live with the TypeScript rules: the four payload
 * schemas and the shared behavioral fixtures. The output is one deterministic
 * JSON file so it can be copied, attached to a release, or fetched by checksum
 * without assuming any repository layout.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { assertPortableSchema, type GameModule, type StandardJSONSchemaV1 } from "@eigeninteractive/rules";
import { parseTwinFixtureFile } from "./twin-fixtures.js";

/** Current format of the language-neutral contract consumed by EigenInteractive's Dart generator. */
export const GAME_CONTRACT_FORMAT_VERSION = 1;

/** One validated twin-fixture document embedded in a {@link GameContract}. */
export interface GameContractFixture {
  /** POSIX-style path relative to the supplied fixtures root. */
  path: string;
  /** Validated fixture document, retained in its original JSON shape. */
  document: unknown;
}

/** The four JSON Schemas emitted for one game `schemaVersion`. */
export interface GameContractVersion {
  schemas: {
    state: Record<string, unknown>;
    observation: Record<string, unknown>;
    action: Record<string, unknown>;
    config: Record<string, unknown>;
  };
}

/** Language-neutral schemas and fixtures shared by a game's Worker and app. */
export interface GameContract {
  formatVersion: typeof GAME_CONTRACT_FORMAT_VERSION;
  game: string;
  versions: Record<string, GameContractVersion>;
  fixtures: GameContractFixture[];
}

/** Inputs for building a {@link GameContract} without writing it. */
export interface BuildGameContractOptions {
  /** Stable display name used as the generated Dart type prefix. */
  game: string;
  /** Authoritative TypeScript rules registry. */
  gameModule: GameModule;
  /** Root containing `v<N>/*.json` twin fixtures. */
  fixturesRoot?: string | URL;
}

/** Inputs for emitting or checking a {@link GameContract} file. */
export interface EmitGameContractOptions extends BuildGameContractOptions {
  /** Destination `game-contract.json` path. */
  output: string | URL;
}

/**
 * Sort object keys so the same schemas always emit the same bytes.
 *
 * Ordering is by UTF-16 code unit — plain `Array#sort` — which is what RFC 8785
 * specifies and what `tool/check-contracts.mjs` uses to digest a manifest. It is
 * *not* `localeCompare`: that collates case-insensitively, so a `$defs` entry
 * named `Move` sorts before `additionalProperties` under one rule and after it
 * under the other. Generated JSON Schema is full of capitalized `$defs` names, so
 * the two orders genuinely disagree, and a digest computed over one would never
 * match a document written by the other.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

/**
 * Emit one payload schema as portable draft-2020-12 JSON Schema.
 *
 * Always the **output** direction. Zod's input schema omits
 * `additionalProperties: false` on objects, because on input a permissive object
 * still strips unknown keys rather than rejecting them — but the contract is what
 * the Dart side generates a validator from, and an open object there means the two
 * halves disagree about an unknown key. Schemas are required to be transform-free
 * (see `GameSchemas`), so the two directions describe the same values and the
 * output one is simply the honest document.
 *
 * The result is then checked against the portable profile, because emission is
 * where an unportable schema can still be fixed cheaply. Skipping this check is
 * how the profile came to be violated in the first place.
 */
function jsonSchema(schema: StandardJSONSchemaV1, label: string): Record<string, unknown> {
  const options = { target: "draft-2020-12" as const };
  let emitted: unknown;
  try {
    emitted = canonical(schema["~standard"].jsonSchema.output(options));
  } catch (error) {
    throw new Error(`${label} cannot emit its type as draft-2020-12 JSON Schema`, { cause: error });
  }
  assertPortableSchema(emitted, label);
  return emitted as Record<string, unknown>;
}

function fixtureFiles(root: string): string[] {
  const found: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith(".json")) found.push(path);
    }
  };
  visit(root);
  return found.sort();
}

function fixtures(fixturesRoot: string | URL | undefined, versions: ReadonlySet<string>): GameContractFixture[] {
  if (fixturesRoot === undefined) return [];
  const root = fixturesRoot instanceof URL ? fixturesRoot.pathname : resolve(fixturesRoot);
  return fixtureFiles(root).map((path) => {
    const document = JSON.parse(readFileSync(path, "utf8")) as unknown;
    const fixture = parseTwinFixtureFile(path, document);
    const fixturePath = relative(root, path).split("\\").join("/");
    const directory = fixturePath.split("/")[0];
    const match = /^v([1-9]\d*)$/.exec(directory ?? "");
    if (match === null) {
      throw new Error(`${fixturePath}: fixtures must live under a v<N>/ directory`);
    }
    const pathVersion = Number(match[1]);
    if (pathVersion !== fixture.schemaVersion) {
      throw new Error(`${fixturePath}: directory v${pathVersion} disagrees with schemaVersion ${fixture.schemaVersion}`);
    }
    if (!versions.has(String(fixture.schemaVersion))) {
      throw new Error(`${fixturePath}: gameModule ships no rules unit for schemaVersion ${fixture.schemaVersion}`);
    }
    return {
      path: fixturePath,
      document: canonical(document),
    };
  });
}

/** Build a deterministic in-memory contract without touching the filesystem. */
export function buildGameContract(options: BuildGameContractOptions): GameContract {
  const game = options.game.trim();
  if (game.length === 0) throw new Error("game contract name must not be empty");

  const versions = Object.fromEntries(
    Object.entries(options.gameModule.versions)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([version, rules]) => [
        version,
        {
          schemas: {
            state: jsonSchema(rules.schemas.state, `v${version} state`),
            observation: jsonSchema(rules.schemas.observation, `v${version} observation`),
            action: jsonSchema(rules.schemas.action, `v${version} action`),
            config: jsonSchema(rules.schemas.config, `v${version} config`),
          },
        },
      ]),
  );

  if (Object.keys(versions).length === 0) {
    throw new Error("game contract must contain at least one schema version");
  }

  return {
    formatVersion: GAME_CONTRACT_FORMAT_VERSION,
    game,
    versions,
    fixtures: fixtures(options.fixturesRoot, new Set(Object.keys(versions))),
  };
}

/** Render one deterministic, newline-terminated contract document. */
export function gameContractJson(options: BuildGameContractOptions): string {
  return `${JSON.stringify(buildGameContract(options), null, 2)}\n`;
}

/** Emit one deterministic, newline-terminated `game-contract.json`. */
export function emitGameContract(options: EmitGameContractOptions): void {
  const output = options.output instanceof URL ? options.output : resolve(options.output);
  writeFileSync(output, gameContractJson(options));
}

/** Fail when an emitted contract is missing or differs from its inputs. */
export function checkGameContract(options: EmitGameContractOptions): void {
  const output = options.output instanceof URL ? options.output : resolve(options.output);
  if (!existsSync(output) || readFileSync(output, "utf8") !== gameContractJson(options)) {
    throw new Error(`${output.toString()} is stale; run eigen-contract`);
  }
}

/** A useful default filename for scripts that accept an output directory. */
export const gameContractFilename = (game: string): string =>
  `${basename(game)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")}-game-contract.json`;
