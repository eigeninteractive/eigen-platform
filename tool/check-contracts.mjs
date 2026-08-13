import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

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

const allowedSchemaKeywords = new Set([
  "$schema",
  "$defs",
  "$ref",
  "type",
  "const",
  "enum",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minLength",
  "maxLength",
  "pattern",
  "items",
  "minItems",
  "maxItems",
  "uniqueItems",
  "properties",
  "required",
  "additionalProperties",
  "minProperties",
  "maxProperties",
  "oneOf",
  "title",
  "description",
  "deprecated",
  "examples",
]);

function portableSchema(value, path) {
  const schema = object(value, path);
  for (const keyword of Object.keys(schema)) {
    if (!allowedSchemaKeywords.has(keyword)) fail(`${path}/${keyword}`, "keyword is outside portable profile v1");
  }

  if ("$schema" in schema && schema.$schema !== draft) fail(`${path}/$schema`, `must be ${draft}`);
  if ("$ref" in schema && !string(schema.$ref, `${path}/$ref`).startsWith("#/$defs/")) {
    fail(`${path}/$ref`, "only local $defs references are allowed");
  }

  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.includes("object") || "properties" in schema) {
    if (schema.additionalProperties !== false) fail(path, "object schemas require additionalProperties: false");
  }
  if (types.includes("integer")) {
    for (const bound of ["minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"]) {
      if (bound in schema && !Number.isSafeInteger(schema[bound])) fail(`${path}/${bound}`, "integer bound must be a safe integer");
    }
  }

  if (schema.properties) {
    for (const [name, property] of Object.entries(object(schema.properties, `${path}/properties`))) {
      portableSchema(property, `${path}/properties/${name}`);
    }
  }
  if (schema.items) portableSchema(schema.items, `${path}/items`);
  if (schema.$defs) {
    for (const [name, definition] of Object.entries(object(schema.$defs, `${path}/$defs`))) {
      portableSchema(definition, `${path}/$defs/${name}`);
    }
  }
  if (schema.oneOf) {
    if (!Array.isArray(schema.oneOf) || schema.oneOf.length < 2) fail(`${path}/oneOf`, "requires at least two branches");
    schema.oneOf.forEach((branch, index) => portableSchema(branch, `${path}/oneOf/${index}`));
  }
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
    portableSchema(contract.schemas[name], `${path}/schemas/${name}`);
  }

  const expected = expectedContractId(contract);
  if (id !== expected) fail(`${path}/contractId`, `digest mismatch; expected ${expected}`);
  return id;
}

function checkCapabilities(capabilities, path, knownContracts) {
  object(capabilities, path);
  if (capabilities.protocolMajor !== 1) fail(`${path}/protocolMajor`, "must be 1");
  sortedUniqueStrings(capabilities.features, `${path}/features`, featurePattern);
  const contracts = sortedUniqueStrings(capabilities.gameContracts, `${path}/gameContracts`, contractIdPattern);
  for (const contract of contracts) {
    if (!knownContracts.has(contract)) fail(`${path}/gameContracts`, `unknown example contract ${contract}`);
  }
  object(capabilities.client, `${path}/client`);
  string(capabilities.client.name, `${path}/client/name`);
  string(capabilities.client.version, `${path}/client/version`);
  string(capabilities.client.platform, `${path}/client/platform`);
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
const knownContracts = new Set([checkContract(documents.get(contractPath), contractPath)]);
const capabilityPath = "contracts/examples/client-capabilities.json";
checkCapabilities(documents.get(capabilityPath), capabilityPath, knownContracts);

console.log(`contracts: ${jsonFiles.length} JSON documents, ${ids.size} schema IDs, ${knownContracts.size} example contract checked`);
