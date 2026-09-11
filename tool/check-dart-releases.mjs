import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packages = [
  ["eigen_client", "dart/eigen_client"],
  ["eigen_codegen", "dart/eigen_codegen"],
  ["eigen_flutter", "flutter"],
  ["eigen_shell", "shell"],
  ["eigen_firebase", "firebase"],
];
const versionPattern =
  "[0-9]+\\.[0-9]+\\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?";

async function checkPackage([name, path]) {
  const [pubspec, changelog] = await Promise.all([
    readFile(join(root, path, "pubspec.yaml"), "utf8"),
    readFile(join(root, path, "CHANGELOG.md"), "utf8"),
  ]);
  const version = pubspec.match(/^version:\s*(\S+)/m)?.[1];
  if (!version) throw new Error(`${path}/pubspec.yaml has no version`);
  if (/^##\s+\\\[/m.test(changelog)) {
    throw new Error(`${path}/CHANGELOG.md contains an escaped section heading`);
  }

  const headingPattern = new RegExp(
    `^##\\s+(\\[?)(${versionPattern})(\\]?)(?:\\s+-.*)?$`,
    "gm",
  );
  const releases = [...changelog.matchAll(headingPattern)];
  if (releases.length === 0) {
    throw new Error(`${path}/CHANGELOG.md has no release headings`);
  }

  for (const release of releases) {
    const [, openingBracket, releaseVersion, closingBracket] = release;
    if (openingBracket !== "[" || closingBracket !== "]") {
      throw new Error(
        `${path}/CHANGELOG.md release ${releaseVersion} is not a linked heading`,
      );
    }
    if (!changelog.includes(`[${releaseVersion}]:`)) {
      throw new Error(
        `${path}/CHANGELOG.md release ${releaseVersion} has no link definition`,
      );
    }
  }

  const latest = releases[0][2];
  if (latest !== version) {
    throw new Error(
      `${name} pubspec is ${version}, but its latest changelog release is ${latest}`,
    );
  }
}

await Promise.all(packages.map(checkPackage));
