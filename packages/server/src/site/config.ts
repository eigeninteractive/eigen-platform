/**
 * Public configuration types for the game's web surface, kept beside the code
 * that renders it. `engine.ts` re-exports them, so an implementor still imports
 * everything from `@eigen/server`.
 */

/** The legal entity publishing the game. Required whenever `site` is present:
 * the default legal documents take it as a prop and cannot render without it. */
export interface OperatorConfig {
  /** Legal entity name. Also the page footers' copyright holder. */
  name: string;
  /** Governing jurisdiction, e.g. `India`. */
  jurisdiction: string;
  /** Support and privacy contact address. */
  contactEmail: string;
  /** Effective date of the legal documents, as displayed. A plain string, not a
   * Date — it is prose, and its format is the operator's choice. */
  effectiveDate: string;
}

/** Legal document overrides. Each is an HTML **fragment** — body content only,
 * no document wrapper; the engine supplies the shell, styling and footer.
 * Omitted documents fall back to the engine's generic templates.
 *
 * A fragment is inserted as-is, so it is the implementor's own trusted markup
 * with their own values already written in. There are no placeholders to fill:
 * the engine's defaults take an {@link OperatorConfig} as typed props, which is
 * what a template's tokens used to stand in for. */
export interface LegalConfig {
  terms?: string;
  privacy?: string;
  deleteAccount?: string;
}

/** The public web surface a deployed game serves on its own host: landing page,
 * legal documents, and the crawler files. Absent → none of it is mounted and
 * the worker stays API-only.
 *
 * Every generated page is overridable by shipping the equivalent static asset
 * (`public/terms.html` beats `GET /terms`), because Cloudflare serves matching
 * assets before invoking the worker. */
export interface SiteConfig {
  /** Public game name in titles and OG tags. Defaults to `appName`. */
  name?: string;
  /** One-sentence hook. The meta description and OG description. */
  tagline: string;
  /** Longer landing-page prose. Defaults to `tagline`. */
  description?: string;
  /** Hex accent colour, e.g. `#1a237e`. Also the `theme-color`. */
  primaryColor: string;
  /** The canonical origin, e.g. `https://strategy.example.com`, without a
   * trailing slash. Required, and not inferred from the request: sitemap
   * entries, canonical links and OG URLs must be absolute, and a proxied
   * request does not reliably carry the public origin. */
  canonicalOrigin: string;
  /** Filenames under `public/screenshots/`, shown as a scrolling strip. */
  screenshots?: string[];
  /** Path under `public/` to the 1200x630 OG image. Defaults to
   * `/og-image.png`, the name `client_reference.md` §22 already prescribes for
   * the Flutter app's own share card — one image, both surfaces. The engine
   * never generates images. */
  ogImage?: string;
  operator: OperatorConfig;
  legal?: LegalConfig;
}

/** {@link SiteConfig} with every default applied and every legal document
 * already rendered to an HTML fragment — what the routes see. Rendering happens
 * once, at startup, so a request never builds prose. */
export interface ResolvedSite {
  name: string;
  tagline: string;
  description: string;
  primaryColor: string;
  /** Normalised: no trailing slash. */
  canonicalOrigin: string;
  screenshots: string[];
  ogImage: string;
  operator: OperatorConfig;
  legal: { terms: string; privacy: string; deleteAccount: string };
}
