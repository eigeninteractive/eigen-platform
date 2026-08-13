import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { GameModule } from "@eigeninteractive/rules";
import { describe, expect, it } from "vitest";
import { buildGameContract, checkGameContract, emitGameContract } from "../src/game-contract.js";

const schema = (name: string) => ({
  "~standard": {
    version: 1 as const,
    vendor: "test",
    validate: (value: unknown) => ({ value }),
    jsonSchema: {
      input: () => ({ title: name, type: "object", properties: {} }),
      output: () => ({ type: "object", title: name, properties: {} }),
    },
  },
});

const rules = {
  schemas: {
    state: schema("State"),
    observation: schema("Observation"),
    action: schema("Action"),
    config: schema("Config"),
  },
} as unknown;

const fixture = (schemaVersion: number) => ({
  schemaVersion,
  cases: [
    {
      kind: "botSeatable",
      name: "accepts the starter bot",
      gameConfig: {},
      botConfig: {},
      expected: true,
    },
  ],
});

describe("buildGameContract", () => {
  it("emits four direction-aware schemas in stable version order", () => {
    const contract = buildGameContract({
      game: " Example ",
      gameModule: {
        versions: { 2: rules, 1: rules },
      } as unknown as GameModule,
    });

    expect(contract.game).toBe("Example");
    expect(Object.keys(contract.versions)).toEqual(["1", "2"]);
    const version = contract.versions["1"];
    expect(version).toBeDefined();
    if (!version) throw new Error("missing generated v1 contract");
    expect(Object.keys(version.schemas)).toEqual(["state", "observation", "action", "config"]);
    expect(version.schemas.action.title).toBe("Action");
    expect(contract.fixtures).toEqual([]);
  });

  it("rejects an empty version registry", () => {
    expect(() =>
      buildGameContract({
        game: "Example",
        gameModule: { versions: {} },
      }),
    ).toThrow("at least one schema version");
  });

  it("requires fixture directories and documents to agree on version", () => {
    const root = mkdtempSync(resolve(tmpdir(), "eigen-contract-fixtures-"));
    mkdirSync(resolve(root, "v2"));
    writeFileSync(resolve(root, "v2", "case.json"), JSON.stringify(fixture(1)));

    expect(() =>
      buildGameContract({
        game: "Example",
        gameModule: { versions: { 1: rules, 2: rules } } as unknown as GameModule,
        fixturesRoot: root,
      }),
    ).toThrow("directory v2 disagrees with schemaVersion 1");
  });

  it("rejects fixtures for an unregistered rules version", () => {
    const root = mkdtempSync(resolve(tmpdir(), "eigen-contract-fixtures-"));
    mkdirSync(resolve(root, "v2"));
    writeFileSync(resolve(root, "v2", "case.json"), JSON.stringify(fixture(2)));

    expect(() =>
      buildGameContract({
        game: "Example",
        gameModule: { versions: { 1: rules } } as unknown as GameModule,
        fixturesRoot: root,
      }),
    ).toThrow("ships no rules unit for schemaVersion 2");
  });

  it("checks the committed contract for drift", () => {
    const root = mkdtempSync(resolve(tmpdir(), "eigen-contract-check-"));
    const output = resolve(root, "game-contract.json");
    const options = {
      game: "Example",
      gameModule: { versions: { 1: rules } } as unknown as GameModule,
      output,
    };

    emitGameContract(options);
    expect(() => checkGameContract(options)).not.toThrow();

    writeFileSync(output, "{}\n");
    expect(() => checkGameContract(options)).toThrow("is stale; run eigen-contract");
  });
});
