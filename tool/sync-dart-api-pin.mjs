#!/usr/bin/env node

// Keep the Flutter shell on the generated API's compatibility line when a
// Changesets version commit advances @eigeninteractive/server. This runs after
// `changeset version` and before the generated Dart client is emitted. Local
// checks use a path override, so without this explicit edit a version PR can
// compile yet publish a shell constraint that excludes its own generated API.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const platformRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverPackage = join(platformRoot, "server/packages/server/package.json");
const flutterPubspec = join(platformRoot, "flutter/pubspec.yaml");

const { version } = JSON.parse(await readFile(serverPackage, "utf8"));
const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
if (!match) throw new Error(`Cannot derive a Dart compatibility line from server version ${JSON.stringify(version)}.`);

const [, major, minor] = match;
const lowerBound = major === "0" ? `0.${minor}.0` : `${major}.0.0`;
const pubspec = await readFile(flutterPubspec, "utf8");
const dependency = /^( {2}eigen_api:)\s*\S+\s*$/m;
if (!dependency.test(pubspec)) throw new Error("flutter/pubspec.yaml must declare eigen_api as a one-line dependency.");

const next = pubspec.replace(dependency, `$1 ^${lowerBound}`);
await writeFile(flutterPubspec, next);
console.log(`Pinned eigen_flutter to eigen_api ^${lowerBound} for server ${version}.`);
