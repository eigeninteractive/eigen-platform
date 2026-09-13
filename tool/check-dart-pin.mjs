#!/usr/bin/env node
/**
 * Assert that every direct Dart consumer can depend on the in-repository package
 * it names.
 *
 *     node tool/check-dart-pin.mjs
 *
 * The consumer pubspecs name a published range; the package they name is built
 * or versioned here. Nothing connected the two, and nothing could notice they
 * had come apart, because `tool/check.sh` runs `tool/link-local-dart.sh` first:
 * every check resolves these packages from the working tree through a
 * `dependency_overrides`, so the declared range is never exercised. The publish
 * job is the only place that resolves without the override, which makes a failed
 * release the earliest possible symptom.
 *
 * That is not hypothetical. `eigen_flutter` sat at `eigen_api: ^0.4.0` while its
 * own source already called `clientSchemaVersions`, renamed by the 0.5 wire
 * contract from `clientSchemaVersion`, so the package could not have compiled
 * against any client its pubspec allowed.
 *
 * Every in-repository Dart package that another one depends on is checked, and
 * they all fail for the same reason in the same window:
 *
 *   eigen_api      generated from the engine's OpenAPI document and stamped with
 *                  the engine's version, consumed by `eigen_flutter` and
 *                  `eigen_client`.
 *   eigen_client   hand-versioned here and consumed by `eigen_flutter` and
 *                  `eigen_shell`. Added after `eigen_client` 0.2.0: pre-1.0 a
 *                  feature release moves the MINOR, so the `^0.1.0` both
 *                  consumers carried stopped admitting the very package whose
 *                  new API their own offline-play code had started calling, and
 *                  the overrides meant every shard stayed green.
 *   eigen_flutter  consumed by `eigen_shell`, `eigen_firebase` and the example.
 *                  Added after `eigen_flutter` 0.10.0 did the same thing one
 *                  release later, which is what settled the question of whether
 *                  the `eigen_client` case was a one-off.
 *   eigen_shell    consumed by the example.
 *   eigen_firebase consumed by the example.
 *
 * The example is not published, so a stale pin there costs no release. It is
 * listed anyway because `link-local-dart.sh` blinds it exactly like the others,
 * and a reference app that names a version nobody can resolve is still wrong.
 *
 * The check is deliberately local: pubspecs only, no registry. A resolution check
 * against pub.dev would fail for a legitimate reason during every release, in the
 * window between the version commit landing and the package publishing, and a
 * release gate that is expected to be red is a gate nobody reads.
 *
 * The rule is that the range must be a caret on the local package's own line.
 * A wider range is refused rather than accepted: `>=0.4.0 <0.6.0` admits 0.5.0
 * and would pass a naive "does it allow the current version" test while still
 * admitting the 0.4.x package that cannot compile. Supporting two lines from one
 * consumer would be a deliberate change to the pairing this repository
 * documents, so it should fail here first and be relaxed on purpose.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PAIRINGS = [
  {
    package: "eigen_api",
    source: "server/clients/dart/pubspec.yaml",
    consumers: ["flutter/pubspec.yaml", "dart/eigen_client/pubspec.yaml"],
  },
  {
    package: "eigen_client",
    source: "dart/eigen_client/pubspec.yaml",
    consumers: ["flutter/pubspec.yaml", "shell/pubspec.yaml"],
  },
  {
    package: "eigen_flutter",
    source: "flutter/pubspec.yaml",
    consumers: ["shell/pubspec.yaml", "firebase/pubspec.yaml", "flutter/example/pubspec.yaml"],
  },
  {
    package: "eigen_shell",
    source: "shell/pubspec.yaml",
    consumers: ["flutter/example/pubspec.yaml"],
  },
  {
    package: "eigen_firebase",
    source: "firebase/pubspec.yaml",
    consumers: ["flutter/example/pubspec.yaml"],
  },
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

function fail(...lines) {
  for (const text of lines) console.error(text);
  process.exit(1);
}

for (const { package: name, source, consumers } of PAIRINGS) {
  const sourceText = /^version:\s*(\S+)/m.exec(await read(source));
  if (!sourceText) fail(`${source} has no version.`);
  const local = parseVersion(sourceText[1], source);
  const printed = `${local.major}.${local.minor}.${local.patch}`;

  for (const consumer of consumers) {
    // Captures the whole value, spaces included, so a range like `>=0.4.0 <0.6.0`
    // reaches the caret check below and is refused for the right reason rather
    // than looking like a missing dependency. An empty value means a nested block
    // (`hosted:`, `path:`), which this script genuinely cannot read.
    const declared = new RegExp(`^\\s{2}${name}:\\s*(\\S.*?)\\s*$`, "m").exec(await read(consumer));
    if (!declared) {
      fail(`${consumer} declares no \`${name}\` dependency, or declares it as a block this script cannot read.`);
    }
    const constraint = declared[1].replace(/^["']|["']$/g, "");

    if (!constraint.startsWith("^")) {
      fail(
        `✗ ${consumer} pins ${name} as "${constraint}".`,
        "",
        "  Expected a caret range on that package's compatibility line.",
      );
    }

    const pinned = parseVersion(constraint.slice(1), consumer);
    if (line(pinned) !== line(local)) {
      fail(
        `✗ ${consumer} pins ${name} "${constraint}", but this repository carries ${printed} (line ${line(local)}.x).`,
        "",
        `  Raise the pin to "^${local.major}.${local.minor}.0" once that version is published.`,
      );
    }
    if (pinned.patch > local.patch) {
      fail(
        `✗ ${consumer} pins ${name} "${constraint}", which is above this repository's ${printed}.`,
      );
    }

    console.log(`✓ ${consumer} ${name} pin "${constraint}" admits ${printed}.`);
  }
}
