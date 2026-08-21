import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "platform.json");

async function json(path) {
  return JSON.parse(await readFile(join(root, path), "utf8"));
}

async function yamlVersion(path) {
  const source = await readFile(join(root, path), "utf8");
  const match = source.match(/^version:\s*([^\s+]+)/m);
  if (!match) throw new Error(`No version in ${path}`);
  return match[1];
}

async function docsLine() {
  const source = await readFile(join(root, "web/docusaurus.config.ts"), "utf8");
  const match = source.match(/current:\s*\{[\s\S]*?label:\s*["']([^"']+)["']/);
  if (!match) throw new Error("No current docs label in web/docusaurus.config.ts");
  return match[1];
}

async function buildManifest() {
  const [rules, kernel, server, testkit, scaffolder, dartApi, flutter, firebase, client, codegen, docs] =
    await Promise.all([
      json("server/packages/rules/package.json"),
      json("server/packages/kernel/package.json"),
      json("server/packages/server/package.json"),
      json("server/packages/testkit/package.json"),
      json("server/packages/create-eigen-game/package.json"),
      yamlVersion("server/clients/dart/pubspec.yaml"),
      yamlVersion("flutter/pubspec.yaml"),
      yamlVersion("firebase/pubspec.yaml"),
      yamlVersion("dart/eigen_client/pubspec.yaml"),
      yamlVersion("dart/eigen_codegen/pubspec.yaml"),
      docsLine(),
    ]);

  return {
    $schema: "./tool/platform.schema.json",
    platform: "vnext-dev",
    importedAt: "2026-08-13",
    components: {
      server: {
        path: "server",
        sourceRepository:
          "https://github.com/eigeninteractive/eigen-server.git",
        baseCommit: "2cac83c27d3ecf85f553b998106c3626997f9310",
        importCommit: "1b77ba7341f387c95ccaaf7d7c1051e8b0bf1e07",
        packages: {
          [rules.name]: rules.version,
          [kernel.name]: kernel.version,
          [server.name]: server.version,
          [testkit.name]: testkit.version,
          [scaffolder.name]: scaffolder.version,
        },
        dartApi,
      },
      flutter: {
        path: "flutter",
        sourceRepository:
          "https://github.com/eigeninteractive/eigen-flutter.git",
        baseCommit: "95fe8c196a192b635ad2cbc8ec58f97a17c47dca",
        importCommit: "461917323107f23a74f55ebb4f64fe1555990176",
        packages: {
          eigen_flutter: flutter,
        },
      },
      firebase: {
        path: "firebase",
        sourceRepository:
          "https://github.com/eigeninteractive/eigen-flutter.git",
        baseCommit: "95fe8c196a192b635ad2cbc8ec58f97a17c47dca",
        importCommit: "461917323107f23a74f55ebb4f64fe1555990176",
        packages: {
          eigen_firebase: firebase,
        },
      },
      dart: {
        path: "dart",
        sourceRepository:
          "https://github.com/eigeninteractive/eigen-flutter.git",
        baseCommit: "95fe8c196a192b635ad2cbc8ec58f97a17c47dca",
        importCommit: "461917323107f23a74f55ebb4f64fe1555990176",
        packages: {
          eigen_client: client,
          eigen_codegen: codegen,
        },
      },
      web: {
        path: "web",
        sourceRepository: "https://github.com/eigeninteractive/eigen-web.git",
        baseCommit: "6fdadef77dceed34825254dc45f694bf5e53b671",
        importCommit: "0a45cf20e5c6b26e82e504d053d67c07f4e63282",
        docsLine: docs,
      },
    },
  };
}

const expected = `${JSON.stringify(await buildManifest(), null, 2)}\n`;
if (process.argv.includes("--check")) {
  const actual = await readFile(manifestPath, "utf8");
  if (actual !== expected) {
    throw new Error("platform.json is stale; run: npm run manifest");
  }
} else {
  await writeFile(manifestPath, expected);
}
