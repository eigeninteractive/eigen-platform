#!/usr/bin/env node
/**
 * Assert that the Flutter shell can depend on the `eigen_api` client this
 * repository generates.
 *
 *     node tool/check-dart-pin.mjs
 *
 * `flutter/pubspec.yaml` names a published `eigen_api` range; `pnpm dart-client`
 * generates that package from the engine's OpenAPI document and stamps it with
 * the engine's version. Nothing connected the two, and nothing could notice they
 * had come apart, because `tool/check.sh` runs `tool/link-local-dart.sh` first:
 * every check resolves the client from `server/clients/dart` through a
 * `dependency_overrides`, so the declared range is never exercised. The publish
 * job is the only place that resolves without the override, which makes a failed
 * release the earliest possible symptom.
 *
 * That is not hypothetical. `eigen_flutter` sat at `eigen_api: ^0.4.0` while its
 * own source already called `clientSchemaVersions`, renamed by the 0.5 wire
 * contract from `clientSchemaVersion`, so the package could not have compiled
 * against any client its pubspec allowed.
 *
 * The check is deliberately local: two files, no registry. A resolution check
 * against pub.dev would fail for a legitimate reason during every release, in the
 * window between the version commit landing and `eigen_api` publishing, and a
 * release gate that is expected to be red is a gate nobody reads.
 *
 * The rule is that the range must be a caret on the generated client's own line.
 * A wider range is refused rather than accepted: `>=0.4.0 <0.6.0` admits 0.5.0
 * and would pass a naive "does it allow the current version" test while still
 * admitting the 0.4.x client that cannot compile. Supporting two engine lines
 * from one shell would be a deliberate change to the pairing this repository
 * documents, so it should fail here first and be relaxed on purpose.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT = "server/clients/dart/pubspec.yaml";
const CONSUMERS = [
  "flutter/pubspec.yaml",
  "dart/eigen_client/pubspec.yaml",
];

async function read(path) {
  return await readFile(join(root, path), "utf8");
}

/** Pre-1.0 the breaking axis is the MINOR, so a 0.x line is `0.<minor>`. */
function line({ major, minor }) {
  return major === 0 ? `0.${minor}` : `${major}`;
}

function parseVersion(text, path) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(text);
  if (!match) throw new Error(`${path} carries a version this script cannot read: "${text}"`);
  const [, major, minor, patch] = match;
  return { major: Number(major), minor: Number(minor), patch: Number(patch) };
}

const clientText = /^version:\s*(\S+)/m.exec(await read(CLIENT));
if (!clientText) fail(`${CLIENT} has no version.`);
const client = parseVersion(clientText[1], CLIENT);

// Captures the whole value, spaces included, so a range like `>=0.4.0 <0.6.0`
// reaches the caret check below and is refused for the right reason rather than
// looking like a missing dependency. An empty value means a nested block
// (`hosted:`, `path:`), which this script genuinely cannot read.
function fail(...lines) {
  for (const text of lines) console.error(text);
  process.exit(1);
}

for (const consumer of CONSUMERS) {
  const declared = /^\s{2}eigen_api:\s*(\S.*?)\s*$/m.exec(await read(consumer));
  if (!declared) {
    fail(`${consumer} declares no \`eigen_api\` dependency, or declares it as a block this script cannot read.`);
  }
  const constraint = declared[1].replace(/^["']|["']$/g, "");

  if (!constraint.startsWith("^")) {
    fail(
      `✗ ${consumer} pins eigen_api as "${constraint}".`,
      "",
      "  Expected a caret range on the generated client's compatibility line.",
    );
  }

  const pinned = parseVersion(constraint.slice(1), consumer);
  if (line(pinned) !== line(client)) {
    fail(
      `✗ ${consumer} pins eigen_api "${constraint}", but the generated client is ${client.major}.${client.minor}.${client.patch} (line ${line(client)}.x).`,
      "",
      `  Raise the pin to "^${client.major}.${client.minor}.0" once that client is published.`,
    );
  }
  if (pinned.patch > client.patch) {
    fail(
      `✗ ${consumer} pins eigen_api "${constraint}", which is above the generated client ${client.major}.${client.minor}.${client.patch}.`,
    );
  }

  console.log(`✓ ${consumer} eigen_api pin "${constraint}" admits ${client.major}.${client.minor}.${client.patch}.`);
}
