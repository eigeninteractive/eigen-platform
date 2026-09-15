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

  // Cider is stricter than the file looks, and silent about it. A heading it
  // does not recognise is not rejected: it is demoted to ordinary text, and the
  // next rewrite folds every entry below it into the neighbouring release, or
  // escapes the whole run into the file header. The file still reads correctly
  // to a human afterwards, so nothing but a check like this catches it.
  //
  // Recognition needs all three: the version bracketed, a link definition that
  // resolves the bracket, and an ISO date. The date is the one most easily
  // missed, because a heading without it reads fine and is what a hand-written
  // changelog tends to have -- and it is the one cider does report, by refusing
  // to parse the file at all.
  const headingPattern = new RegExp(
    `^##\\s+(\\[?)(${versionPattern})(\\]?)(\\s+-\\s+\\d{4}-\\d{2}-\\d{2})?(\\s+\\[YANKED\\])?\\s*$`,
    "gm",
  );
  const releases = [...changelog.matchAll(headingPattern)];
  if (releases.length === 0) {
    throw new Error(`${path}/CHANGELOG.md has no release headings`);
  }

  for (const release of releases) {
    const [, openingBracket, releaseVersion, closingBracket, date] = release;
    if (openingBracket !== "[" || closingBracket !== "]") {
      throw new Error(
        `${path}/CHANGELOG.md release ${releaseVersion} is not a linked heading`,
      );
    }
    if (date === undefined) {
      throw new Error(
        `${path}/CHANGELOG.md release ${releaseVersion} has no date; cider reads a release heading as "## [X.Y.Z] - YYYY-MM-DD" and refuses the whole file without one`,
      );
    }
    if (!changelog.includes(`[${releaseVersion}]:`)) {
      throw new Error(
        `${path}/CHANGELOG.md release ${releaseVersion} has no link definition`,
      );
    }
  }

  // Anything else at h2 is invisible to cider, which quietly absorbs it and
  // everything under it into the release above.
  // A separate, non-global copy: `headingPattern` carries `g`, so `test` on it
  // would advance `lastIndex` between calls and answer about the wrong place.
  const oneHeading = new RegExp(headingPattern.source);
  for (const [heading] of changelog.matchAll(/^##\s+.*$/gm)) {
    if (heading.trim() === "## [Unreleased]") continue;
    if (oneHeading.test(heading)) continue;
    throw new Error(
      `${path}/CHANGELOG.md heading is invisible to cider: ${heading.trim()}`,
    );
  }

  const latest = releases[0][2];
  if (latest !== version) {
    throw new Error(
      `${name} pubspec is ${version}, but its latest changelog release is ${latest}`,
    );
  }
}

await Promise.all(packages.map(checkPackage));
