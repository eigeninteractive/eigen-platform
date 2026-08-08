/**
 * Public configuration types for the game's web surface, kept beside the code
 * that renders it. `engine.ts` re-exports them, so an implementor still imports
 * everything from `@eigeninteractive/server`.
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
   * Date, since it is prose and its format is the operator's choice. */
  effectiveDate: string;
}

/** Legal document overrides. Each is an HTML **fragment**: body content only,
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

/** The credit line in every page footer. Set `site.madeByCredit` to your own
 * string, or to `null` to drop it.
 *
 * The footer links whichever part of the line reads {@link CREDIT_BRAND}, so a
 * custom credit that names the engine gets the link too, and one that does not
 * renders as plain text rather than pointing somewhere it never mentioned. */
export const DEFAULT_CREDIT = "Built with EigenInteractive";

/** The linked span inside {@link DEFAULT_CREDIT}, and its destination. */
export const CREDIT_BRAND = "EigenInteractive";
export const CREDIT_URL = "https://eigeninteractive.com";

/** The public web surface a deployed game serves on its own host: download page,
 * legal documents, and the crawler files. Absent → none of it is mounted and
 * the worker stays API-only.
 *
 * The scaffold reserves these paths for the Worker with Static Assets'
 * `run_worker_first`; customize legal prose through this typed config. */
export interface SiteConfig {
  /** Public game name in titles and OG tags. Defaults to `appName`. */
  name?: string;
  /** One-sentence hook. The meta description and OG description. */
  tagline: string;
  /** Longer download-page prose. Defaults to `tagline`. */
  description?: string;
  /** Hex accent colour, e.g. `#1a237e`. Also the `theme-color`. */
  primaryColor: string;
  /** Filenames under `public/screenshots/`, shown as a scrolling strip. */
  screenshots?: string[];
  /** Path under `public/` to the 1200x630 OG image. Defaults to
   * `/og-image.png`, the name the
   * {@link https://eigeninteractive.com/docs/ship-it/branding | branding guide}
   * prescribes for the Flutter app's own share card: one image, both
   * surfaces. The engine never generates images. */
  ogImage?: string;
  /** Footer credit line. Defaults to {@link DEFAULT_CREDIT}; `null` removes it. */
  madeByCredit?: string | null;
  operator: OperatorConfig;
  legal?: LegalConfig;
}

/** {@link SiteConfig} with every default applied and every legal document
 * already rendered to an HTML fragment: what the routes see. Rendering happens
 * once, at startup, so a request never builds prose. */
export interface ResolvedSite {
  name: string;
  tagline: string;
  description: string;
  primaryColor: string;
  screenshots: string[];
  ogImage: string;
  madeByCredit: string | null;
  operator: OperatorConfig;
  legal: { terms: string; privacy: string; deleteAccount: string };
}
