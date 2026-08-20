/**
 * The engine's placeholder app icon, bundled into the worker and served from it.
 *
 * Every page the engine renders links an icon, and until a game ships one of its
 * own there is nothing in `public/` to link: a fresh scaffold's asset directory
 * holds a single `.gitkeep`. Linking `favicon.png` anyway is what left the tab
 * blank, so this is what the shell points at instead, on exactly the same
 * reasoning as the hero's inline mark, which has always fallen back this way.
 *
 * A placeholder, not a default. The moment a game has icons of its own the shell
 * links those instead and this route goes unused; see `hasAppIcons` in
 * `routes/site.tsx` for how that is decided.
 *
 * SVG rather than PNG because the engine has no image pipeline and should not
 * grow one: the mark is two strokes, so it is a few hundred bytes of markup that
 * stays sharp at every size a browser asks for, and it can restyle itself for a
 * dark tab strip, which no single raster file can. Bundled rather than served
 * from `ASSETS` for the reason the fonts are: that binding holds the game's
 * Flutter build, and the engine cannot put files in it.
 */

/** The EigenInteractive primary, matching `site.css.txt` and the Flutter shell's
 * default seed. Used when a game has not configured `site.primaryColor`. */
export const DEFAULT_PRIMARY = "#006a60";

/** Path the placeholder is served from, and linked by in the document shell.
 *
 * Shares the `/_eigen/` prefix with the bundled fonts, which keeps every
 * engine-owned asset URL in one namespace a game will not collide with. The
 * version segment exists for the same reason it does there: to make replacing
 * the artwork a cache miss rather than something to invalidate.
 */
export const ENGINE_ICON_URL = "/_eigen/icon/v1/mark.svg";

/** A CSS hex colour, the only shape interpolated into the markup below. */
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * The placeholder mark, drawn in a game's own accent colour.
 *
 * Only the neutral stroke switches between colour schemes. The accent does not,
 * because an implementor configures one `site.primaryColor` and there is no
 * second value to pair it with, whereas the neutral is the stroke that actually
 * vanishes against a dark tab strip. The two paths are the same geometry the
 * hero's inline `EigenMark` draws; they differ only in taking literal colours,
 * since a standalone document has no page tokens to inherit.
 *
 * `primaryColor` reaches this from implementor configuration rather than from a
 * request, so it is trusted input. It is still shape-checked: the cost is one
 * regex at startup, and the failure it rules out is markup injection into a file
 * every visitor loads.
 */
export function engineIconSvg(primaryColor: string = DEFAULT_PRIMARY): string {
  const accent = HEX.test(primaryColor) ? primaryColor : DEFAULT_PRIMARY;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="25.3 19 149 149" width="160" height="160" fill="none"><style>.a{stroke:${accent}}.b{stroke:#1B1E24}@media(prefers-color-scheme:dark){.b{stroke:#F4F1EA}}</style><path class="a" d="M80 109L150.711 33.289" stroke-width="26" stroke-linecap="butt"/><path class="b" d="M80 160V104L48.887 72.887" stroke-width="26" stroke-linejoin="miter" stroke-linecap="butt"/></svg>`;
}
