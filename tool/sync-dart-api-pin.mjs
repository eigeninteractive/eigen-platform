#!/usr/bin/env node

// Keep direct Dart consumers on the generated API they were built against when a
// Changesets version commit advances @eigeninteractive/server. This runs after
// `changeset version` and before the generated Dart client is emitted. The
// client is a workspace member stamped with that same version, so without this
// explicit edit a version PR that crosses a line would leave these consumers
// naming a range that excludes the client it just stamped, and `pub get` would
// fail for the whole workspace rather than only at publish time.
//
// The floor is the stamped version itself, not the start of its line. A patch
// release can add an optional wire field that a consumer in this workspace reads
// in the same release. A floor of `^0.8.0` would then let an app still locked to
// eigen_api 0.8.0 resolve that consumer, and fail to compile against a model
// with no such field. Naming the exact version costs nothing: the caret still
// spans the whole line, and the line is all the compatibility table and the
// scaffold gate read from this constraint.

import { execFileSync } from "node:child_process";
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

const [, major, minor, patch] = match;
const lowerBound = `${major}.${minor}.${patch}`;
const dependency = /^( {2}eigen_api:)\s*(\S+)\s*$/m;

// The part of a version a pub caret holds fixed: the major from 1.0, and the
// minor before it, where `^0.11.0` means `<0.12.0`.
const line = (constraint) => {
  const parts = /^\^?(\d+)\.(\d+)\./.exec(constraint);
  if (!parts) throw new Error(`Cannot read a compatibility line from eigen_api ${JSON.stringify(constraint)}.`);
  return parts[1] === "0" ? `0.${parts[2]}` : parts[1];
};

for (const pubspecPath of consumerPubspecs) {
  const pubspec = await readFile(pubspecPath, "utf8");
  const current = dependency.exec(pubspec)?.[2];
  if (current === undefined) {
    throw new Error(`${pubspecPath} must declare eigen_api as a one-line dependency.`);
  }
  await writeFile(pubspecPath, pubspec.replace(dependency, `$1 ^${lowerBound}`));

  // Crossing a line strands the published package: it still names the old
  // line, so an app resolving it beside anything built for the new engine
  // fails `pub get`. The Dart release only versions packages with Unreleased
  // entries, so the entry is what makes the consumer ship with its new floor
  // instead of being skipped. Inside a line the published range already admits
  // the new client, and nothing needs releasing for the floor alone.
  if (line(current) !== line(lowerBound)) {
    execFileSync("cider", [`--project-root=${dirname(pubspecPath)}`, "log", "changed", `Requires \`eigen_api\` ${lowerBound}, the client generated from engine ${lowerBound}.`], { stdio: "inherit" });
  }
}
console.log(`Pinned Dart consumers to eigen_api ^${lowerBound} for server ${version}.`);
