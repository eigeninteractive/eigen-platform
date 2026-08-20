/**
 * The shared document shell for every engine-rendered public page: the landing
 * page, the legal documents, and the `/j` share page.
 *
 * hono/jsx rather than string concatenation, so interpolated values are escaped
 * by the renderer instead of by a hand-rolled helper someone can forget to
 * call. Display names reach these OG tags and are user-controlled, so that
 * distinction is a security property, not a style preference. hono is already a
 * dependency; no new runtime is added.
 *
 * Raw markup (an implementor's legal fragment, the JSON-LD block, the
 * stylesheet) goes through `dangerouslySetInnerHTML`, which is honest: those
 * are trusted, build-time strings, and every other value on the page is
 * escaped.
 */

import type { PropsWithChildren } from "hono/jsx";
import { CREDIT_BRAND, CREDIT_URL, DEFAULT_CREDIT } from "./config.js";
import { fontFaceCss } from "./fonts.js";
import { ENGINE_ICON_URL } from "./icon.js";
import styles from "./site.css.txt";

/** Icon paths, defaulted to what `flutter_launcher_icons` already emits into a
 * Flutter app's `web/` directory (see the
 * {@link https://eigeninteractive.com/docs/ship-it/branding | branding guide}).
 * An implementor who builds the app has these files already and copies them
 * into `public/`; nobody has to author a second icon set for the web.
 *
 * These are asset paths, so they are only correct once such a file exists. A
 * page renders them when `appIcons` says so and falls back to
 * {@link ENGINE_ICON_URL} when it does not. */
export const ICONS = {
  favicon: "/favicon.png",
  appleTouch: "/icons/Icon-192.png",
  icon192: "/icons/Icon-192.png",
  icon512: "/icons/Icon-512.png",
  maskable192: "/icons/Icon-maskable-192.png",
  maskable512: "/icons/Icon-maskable-512.png",
} as const;

export interface PageProps {
  /** `<title>`, and the OG/Twitter title. */
  title: string;
  /** Meta description, and the OG/Twitter description. */
  description: string;
  /** Site name for `og:site_name`. Defaults to `title`. */
  siteName?: string;
  /** Hex accent colour. Sets `--primary` and `theme-color`; the stylesheet's
   * own fallback applies when this is absent. */
  primaryColor?: string;
  /** Absolute canonical URL. Omit on pages that should not be indexed. */
  canonicalUrl?: string;
  /** Absolute OG image URL (1200x630). */
  ogImage?: string;
  /** `true` to emit `noindex, nofollow` instead of a canonical link. */
  noindex?: boolean;
  /** Already-serialised JSON-LD. */
  jsonLd?: string;
  /** Legal entity for the footer's copyright and legal links. Omitted → neither
   * is rendered, which is the case for a worker running `deepLink` without
   * `site`: the legal routes do not exist to link to. */
  operatorName?: string;
  /** Footer credit line. Omitted → {@link DEFAULT_CREDIT}; `null` removes it. */
  madeByCredit?: string | null;
  /** Whether this game has icons of its own in `public/`. `true` links
   * {@link ICONS}; omitted or `false` links the engine placeholder.
   *
   * Defaults to the placeholder because that is the answer that is always
   * serveable. A page that guesses wrong this way shows the engine's mark; the
   * other way round it shows nothing at all. */
  appIcons?: boolean;
}

/** Every link the engine renders leaves the page it is on rather than replacing
 * it: the legal pages, the stores, the credit. A visitor reading Terms is
 * mid-download, and a store link on iOS hands the tab to the store app.
 *
 * `noopener` because `_blank` otherwise gives the opened page a handle back to
 * this one. Modern browsers imply it; it is still spelled out, since the
 * destinations here are configured by the operator. Spread into a JSX tag:
 * `<a href="…" {...NEW_TAB}>`. */
export const NEW_TAB = { target: "_blank", rel: "noopener" } as const;

/** The engine's footer: the legal links every page must carry, the operator's
 * copyright, and the credit.
 *
 * The two halves are independent. Legal links need `site`, since without it the
 * routes are not mounted and linking to them would be a 404, but the credit
 * does not, so a worker that has configured nothing still ends its pages with
 * a line rather than with whitespace. */
function Footer({ operatorName, credit }: { operatorName?: string; credit: string | null }) {
  return (
    <footer>
      {operatorName !== undefined && (
        <>
          <span>
            &copy; {new Date().getUTCFullYear()} {operatorName}
          </span>
          <a href="/terms" {...NEW_TAB}>
            Terms of Service
          </a>
          <a href="/privacy" {...NEW_TAB}>
            Privacy Policy
          </a>
          <a href="/delete-account" {...NEW_TAB}>
            Delete Account
          </a>
        </>
      )}
      {credit !== null && <Credit credit={credit} />}
    </footer>
  );
}

/** The engine's credit line, with the brand inside it linked and nothing else.
 *
 * A whole-line link would make "Build with" clickable too, which is not what it
 * points at. Splitting on the brand keeps the sentence as prose and marks only
 * the name, and leaves a custom credit that never mentions the engine as plain
 * text, rather than silently linking someone else's words to us. */
function Credit({ credit }: { credit: string }) {
  const at = credit.indexOf(CREDIT_BRAND);
  if (at === -1) return <span class="credit">{credit}</span>;
  return (
    <span class="credit">
      {credit.slice(0, at)}
      <a href={CREDIT_URL} {...NEW_TAB}>
        {CREDIT_BRAND}
      </a>
      {credit.slice(at + CREDIT_BRAND.length)}
    </span>
  );
}

/**
 * The readable ink for text sitting on `--primary`.
 *
 * The stylesheet pairs its own primary with an `--on-primary` per colour
 * scheme, but a game that configures `site.primaryColor` overrides only half of
 * that pair, and the two schemes disagree about which ink is right, so no
 * single fallback works. Deriving the partner here keeps the call-to-action
 * legible whatever colour an implementor picks, including colours light enough
 * that white-on-primary would fail.
 *
 * WCAG relative luminance. The threshold is where contrast against white and
 * against the near-black below cross, both a little above 4.5:1. A malformed
 * hex yields `NaN`, which fails the comparison and lands on white, today's
 * unconditional behaviour.
 */
export function onPrimary(hex: string): string {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? [...value].map((c) => c + c).join("") : value;
  const linear = (index: number): number => {
    const channel = Number.parseInt(full.slice(index * 2, index * 2 + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * linear(0) + 0.7152 * linear(1) + 0.0722 * linear(2);
  return luminance > 0.18 ? "#0d1211" : "#ffffff";
}

export function Page(props: PropsWithChildren<PageProps>) {
  const siteName = props.siteName ?? props.title;
  const credit = props.madeByCredit === undefined ? DEFAULT_CREDIT : props.madeByCredit;
  return (
    <html lang="en" style={props.primaryColor === undefined ? undefined : `--primary:${props.primaryColor};--on-primary:${onPrimary(props.primaryColor)}`}>
      <head>
        {/* Lowercase: hono/jsx passes attribute names through verbatim, unlike
            React's charSet→charset mapping. */}
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        <meta name="description" content={props.description} />
        {props.primaryColor !== undefined && <meta name="theme-color" content={props.primaryColor} />}
        {props.noindex === true ? <meta name="robots" content="noindex, nofollow" /> : props.canonicalUrl !== undefined && <link rel="canonical" href={props.canonicalUrl} />}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={props.title} />
        <meta property="og:description" content={props.description} />
        {props.canonicalUrl !== undefined && <meta property="og:url" content={props.canonicalUrl} />}
        {props.ogImage !== undefined && (
          <>
            <meta property="og:image" content={props.ogImage} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta name="twitter:image" content={props.ogImage} />
          </>
        )}
        <meta name="twitter:card" content={props.ogImage === undefined ? "summary" : "summary_large_image"} />
        <meta name="twitter:title" content={props.title} />
        <meta name="twitter:description" content={props.description} />
        {/* Apple's touch icon has no SVG support, so a game without its own
            icons gets no such link rather than one pointing at a file that is
            not there. iOS then derives its home-screen icon from the page,
            which is a better answer than a broken request. */}
        {props.appIcons === true ? (
          <>
            <link rel="icon" href={ICONS.favicon} />
            <link rel="apple-touch-icon" href={ICONS.appleTouch} />
          </>
        ) : (
          <link rel="icon" type="image/svg+xml" href={ENGINE_ICON_URL} />
        )}
        <link rel="manifest" href="/site.webmanifest" />
        {/* The faces first, so the rules that use them are already declared by
            the time the cascade reaches them. Generated from the same table the
            routes serve, so a URL cannot drift from what answers it. */}
        <style dangerouslySetInnerHTML={{ __html: fontFaceCss + styles }} />
        {props.jsonLd !== undefined && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: props.jsonLd }} />}
      </head>
      <body>
        <div class="wrap">
          {props.children}
          {(props.operatorName !== undefined || credit !== null) && <Footer operatorName={props.operatorName} credit={credit} />}
        </div>
      </body>
    </html>
  );
}

/**
 * Render a page component to a complete HTML document.
 *
 * The `<!DOCTYPE html>` prefix is added here because JSX cannot express a
 * doctype node. Every engine page is a synchronous component, so the JSX node
 * stringifies synchronously.
 */
export function renderDocument(node: unknown): string {
  return `<!DOCTYPE html>${String(node)}`;
}

/** Insert a trusted, already-rendered HTML fragment. Used for legal documents,
 * whose source is either the engine's own components or an implementor's
 * build-time file, never anything a user submits. */
export function RawHtml({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
