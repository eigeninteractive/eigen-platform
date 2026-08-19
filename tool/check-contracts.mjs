import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
// The portable-schema profile has exactly one implementation, in the package game
// authors already depend on, so this tool and the contract emitter cannot disagree
// about what is portable. `tool/check.sh` builds it before running this.
import { portableSchemaViolations } from "../server/packages/rules/dist/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const contractsRoot = join(root, "contracts");
const draft = "https://json-schema.org/draft/2020-12/schema";
const contractIdPattern = /^[a-z][a-z0-9-]*\/v[1-9][0-9]*\/sha256:[0-9a-f]{64}$/;
const featurePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-v[1-9][0-9]*$/;

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    }),
  );
  return nested.flat();
}

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

function object(value, path) {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    fail(path, "expected an object");
  }
  return value;
}

function string(value, path) {
  if (typeof value !== "string") fail(path, "expected a string");
  return value;
}

function integer(value, path) {
  if (!Number.isSafeInteger(value)) fail(path, "expected a safe integer");
  return value;
}

function sortedUniqueStrings(value, path, pattern) {
  if (!Array.isArray(value)) fail(path, "expected an array");
  const strings = value.map((entry, index) => string(entry, `${path}/${index}`));
  for (const [index, entry] of strings.entries()) {
    if (!pattern.test(entry)) fail(`${path}/${index}`, `invalid token ${entry}`);
  }
  const canonical = [...new Set(strings)].sort();
  if (canonical.length !== strings.length || canonical.some((entry, index) => entry !== strings[index])) {
    fail(path, "must be sorted and contain no duplicates");
  }
  return strings;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function expectedContractId(contract) {
  const digestable = structuredClone(contract);
  delete digestable.$schema;
  delete digestable.contractId;
  const digest = createHash("sha256").update(canonical(digestable)).digest("hex");
  return `${contract.game.key}/v${contract.version}/sha256:${digest}`;
}

function checkContract(contract, path) {
  object(contract, path);
  if (contract.profileVersion !== 1) fail(`${path}/profileVersion`, "must be 1");
  const id = string(contract.contractId, `${path}/contractId`);
  if (!contractIdPattern.test(id)) fail(`${path}/contractId`, "invalid contract ID");
  object(contract.game, `${path}/game`);
  string(contract.game.key, `${path}/game/key`);
  integer(contract.version, `${path}/version`);
  object(contract.compatibility, `${path}/compatibility`);
  if (contract.compatibility.protocolMajor !== 1) fail(`${path}/compatibility/protocolMajor`, "must be 1");
  sortedUniqueStrings(contract.compatibility.requiredFeatures, `${path}/compatibility/requiredFeatures`, featurePattern);

  object(contract.creation, `${path}/creation`);
  sortedUniqueStrings(contract.creation.access, `${path}/creation/access`, /^(private|public)$/);
  object(contract.creation.players, `${path}/creation/players`);
  const minimum = integer(contract.creation.players.minimum, `${path}/creation/players/minimum`);
  const maximum = integer(contract.creation.players.maximum, `${path}/creation/players/maximum`);
  if (minimum < 1 || maximum > 32 || minimum > maximum) fail(`${path}/creation/players`, "invalid player bounds");

  object(contract.schemas, `${path}/schemas`);
  for (const name of ["config", "state", "action", "observation"]) {
    // Same profile check the contract emitter runs, imported rather than
    // restated: two copies of this rule would drift, and a schema this tool
    // accepts must be one a generated Dart validator can enforce.
    for (const violation of portableSchemaViolations(contract.schemas[name])) {
      fail(`${path}/schemas/${name}${violation.pointer === "/" ? "" : violation.pointer}`, violation.problem);
    }
  }

  const expected = expectedContractId(contract);
  if (id !== expected) fail(`${path}/contractId`, `digest mismatch; expected ${expected}`);
  return id;
}

const jsonFiles = (await filesUnder(contractsRoot)).filter((path) => path.endsWith(".json")).sort();
const documents = new Map();
const ids = new Map();

for (const path of jsonFiles) {
  const display = relative(root, path);
  let document;
  try {
    document = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail(display, `invalid JSON: ${error.message}`);
  }
  documents.set(display, document);
  if (display.includes(".schema.")) {
    if (document.$schema !== draft) fail(`${display}/$schema`, `must be ${draft}`);
    const id = string(document.$id, `${display}/$id`);
    if (ids.has(id)) fail(`${display}/$id`, `duplicates ${ids.get(id)}`);
    ids.set(id, display);
  }
}

const contractPath = "contracts/examples/counter-v1.game-contract.json";
const contractId = checkContract(documents.get(contractPath), contractPath);

console.log(`contracts: ${jsonFiles.length} JSON documents, ${ids.size} schema IDs, ${contractId} verified`);
