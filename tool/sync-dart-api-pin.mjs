#!/usr/bin/env node

// Keep direct Dart consumers on the generated API's compatibility line when a
// Changesets version commit advances @eigeninteractive/server. This runs after
// `changeset version` and before the generated Dart client is emitted. Local
// checks use a path override, so without this explicit edit a version PR can
// compile yet publish a shell constraint that excludes its own generated API.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const platformRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverPackage = join(platformRoot, "server/packages/server/package.json");
const consumerPubspecs = [
  join(platformRoot, "flutter/pubspec.yaml"),
  join(platformRoot, "dart/eigen_client/pubspec.yaml"),
];

const { version } = JSON.parse(await readFile(serverPackage, "utf8"));
const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
if (!match) throw new Error(`Cannot derive a Dart compatibility line from server version ${JSON.stringify(version)}.`);

const [, major, minor] = match;
const lowerBound = major === "0" ? `0.${minor}.0` : `${major}.0.0`;
const dependency = /^( {2}eigen_api:)\s*\S+\s*$/m;
for (const pubspecPath of consumerPubspecs) {
  const pubspec = await readFile(pubspecPath, "utf8");
  if (!dependency.test(pubspec)) {
    throw new Error(`${pubspecPath} must declare eigen_api as a one-line dependency.`);
  }
  await writeFile(pubspecPath, pubspec.replace(dependency, `$1 ^${lowerBound}`));
}
console.log(`Pinned Dart consumers to eigen_api ^${lowerBound} for server ${version}.`);
