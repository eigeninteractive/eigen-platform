/**
 * Where the engine range emitted into a scaffolded project comes from.
 *
 * Its own module because the two branches below execute in different worlds —
 * one only inside this repository, the other only inside a published tarball —
 * and a function whose published-only path never runs in CI is a function that
 * is not tested. `src/index.ts` uses it; the package `exports` map does not
 * expose it, so it is internal despite being importable by the tests.
 */

/** The dependency whose version the scaffolder emits into the generated server. */
export const ENGINE_PACKAGE = "@eigeninteractive/server";

/**
 * The engine range for a scaffolded project, from this package's own
 * `@eigeninteractive/server` devDependency.
 *
 * That number is not maintained by anyone: it is the version CI compiled the
 * templates against, because `pnpm -r typecheck` runs
 * `tsc -p templates/worker/tsconfig.json` inside this workspace. Emitting
 * anything else would mean shipping templates paired with an engine no build
 * ever saw.
 *
 * It replaced a derivation from this package's OWN version, which was correct
 * only while `create-eigen-game` sat in the `fixed` changesets group — and that
 * membership is what forced an engine-wide release for every scaffolder-only
 * change. Reading the dependency keeps the guarantee and drops the coupling.
 *
 * Two branches, because the same manifest reads differently in the two places
 * this runs:
 *
 * - **Published tarball** — pnpm rewrites `workspace:*` to the exact version
 *   while packing, so the manifest already states it (`"0.2.0"`), and no
 *   sibling package exists on disk to consult.
 * - **This workspace** — the manifest still says `workspace:*`, which names no
 *   version, so the sibling package is read directly.
 *
 * @param declared the raw `@eigeninteractive/server` devDependency value
 * @param readSiblingVersion consulted only for the `workspace:` protocol
 */
export function engineRange(declared: string | undefined, readSiblingVersion: () => string | undefined): string {
  if (!declared) {
    throw new Error(`create-eigen-game has no ${ENGINE_PACKAGE} devDependency, which is where the engine range it emits comes from`);
  }

  const version = declared.startsWith("workspace:") ? readSiblingVersion() : declared;

  if (!version) {
    throw new Error(`create-eigen-game declares ${ENGINE_PACKAGE} as "${declared}" but the workspace package could not be read, so there is no engine version to emit`);
  }

  // pnpm packs `workspace:*` as a bare version, which is what makes the caret
  // below correct. Asserting it means a change in that behaviour fails here
  // rather than emitting something like `^^0.3.0` into a real project.
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`expected an exact ${ENGINE_PACKAGE} version to build a range from, got "${version}"`);
  }

  return `^${version}`;
}
