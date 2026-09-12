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

// The engine release line the documentation site describes.
//
// Read from the spec rather than scraped out of `docusaurus.config.ts`, because
// the config no longer contains a number to scrape: it derives its own version
// label from this same file, so there is exactly one place the line is stated.
// Scraping the config used to work and then silently stopped meaning anything
// -- the pattern matched the first quoted `label:` after `current: {`, so once
// the label became an expression it ran on and matched a navbar item instead,
// and the only symptom was `platform.json` going stale for no visible reason.
//
// Pre-1.0 the breaking axis is the MINOR (`^0.6.0` resolves to `>=0.6.0
// <0.7.0`), so a 0.x line is `0.<minor>.x`; from 1.0.0 on it is the major.
async function docsLine() {
  const { version } = (await json("web/api/openapi.json")).info;
  const match = /^(\d+)\.(\d+)\.\d+/.exec(version);
  if (!match) throw new Error(`Unreadable version in web/api/openapi.json: "${version}"`);
  const [, major, minor] = match;
  return major === "0" ? `0.${minor}.x` : `${major}.x`;
}

async function buildManifest() {
  const [
    rules,
    kernel,
    server,
    testkit,
    scaffolder,
    dartApi,
    flutter,
    shell,
    firebase,
    client,
    codegen,
    docs,
  ] = await Promise.all([
      json("server/packages/rules/package.json"),
      json("server/packages/kernel/package.json"),
      json("server/packages/server/package.json"),
      json("server/packages/testkit/package.json"),
      json("server/packages/create-eigen-game/package.json"),
      yamlVersion("server/clients/dart/pubspec.yaml"),
      yamlVersion("flutter/pubspec.yaml"),
      yamlVersion("shell/pubspec.yaml"),
      yamlVersion("firebase/pubspec.yaml"),
      yamlVersion("dart/eigen_client/pubspec.yaml"),
      yamlVersion("dart/eigen_codegen/pubspec.yaml"),
      docsLine(),
    ]);

  return {
    $schema: "./tool/platform.schema.json",
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
      shell: {
        path: "shell",
        sourceRepository:
          "https://github.com/eigeninteractive/eigen-flutter.git",
        baseCommit: "95fe8c196a192b635ad2cbc8ec58f97a17c47dca",
        importCommit: "461917323107f23a74f55ebb4f64fe1555990176",
        packages: {
          eigen_shell: shell,
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
