/**
 * The two brand faces, bundled into the worker and served from it.
 *
 * Served rather than inlined into the stylesheet. Inlining costs its bytes on
 * every page of every visit and cannot be cached separately; a served file is
 * fetched once and reused across every page, every game on the origin, and
 * every later session. `font-display: swap` means neither choice blocks the
 * first paint, which is what inlining would have been buying.
 *
 * Bundled rather than served from the `ASSETS` binding, because that binding
 * holds the game's Flutter build. The engine cannot put files there, and a
 * scaffolded project should not have to copy the engine's fonts into its own
 * web output to make its own legal pages render correctly.
 *
 * Each face is a generated TypeScript module holding its base64, not a bundler
 * asset import: `vitest-pool-workers` resolves worker-side modules outside
 * vite's plugin graph, so a `.woff2` loader would work in the build and leave
 * this route answering 500 in the test suite. woff2 is Brotli-compressed
 * already, so this is about 90KB of the worker's 3MB compressed budget, and it
 * is decoded per request rather than at module scope so it costs nothing
 * against the 1s startup limit.
 */

import interWoff2 from "./fonts/inter.js";
import spaceGroteskWoff2 from "./fonts/space-grotesk.js";

/**
 * Bumped when a font file is replaced.
 *
 * The URLs below are served `immutable`, which tells a browser never to
 * revalidate — correct only while a URL's bytes never change. Replacing a file
 * without bumping this would leave every returning visitor on the old face
 * until their cache expired, a year later.
 */
const VERSION = "v1";

const PREFIX = `/_eigen/font/${VERSION}`;

interface BundledFont {
  /** Path this is served from, and referenced by in `@font-face`. */
  readonly url: string;
  /** CSS `font-family`, matching the names the stylesheet uses. */
  readonly family: string;
  /** Weight range the variable file covers. */
  readonly weights: string;
  readonly base64: string;
}

export const FONTS: readonly BundledFont[] = [
  { url: `${PREFIX}/inter.woff2`, family: "Inter", weights: "100 900", base64: interWoff2 },
  { url: `${PREFIX}/space-grotesk.woff2`, family: "Space Grotesk", weights: "300 700", base64: spaceGroteskWoff2 },
];

/**
 * `@font-face` rules for the bundled faces, prepended to the stylesheet.
 *
 * Generated rather than written in `site.css` so the URLs and the routes cannot
 * disagree: both come from [FONTS].
 */
export const fontFaceCss: string = FONTS.map((font) => `@font-face{font-family:"${font.family}";src:url(${font.url}) format("woff2");font-weight:${font.weights};font-style:normal;font-display:swap}`).join("");

/** Decodes a bundled font to the bytes served for it. */
export function fontBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
