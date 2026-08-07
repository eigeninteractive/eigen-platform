/**
 * The shared document shell for every engine-rendered public page — the landing
 * page, the legal documents, and the `/j` share page.
 *
 * hono/jsx rather than string concatenation, so interpolated values are escaped
 * by the renderer instead of by a hand-rolled helper someone can forget to
 * call. Display names reach these OG tags and are user-controlled, so that
 * distinction is a security property, not a style preference. hono is already a
 * dependency; no new runtime is added.
 *
 * Raw markup — an implementor's legal fragment, the JSON-LD block, the
 * stylesheet — goes through `dangerouslySetInnerHTML`, which is honest: those
 * are trusted, build-time strings, and every other value on the page is
 * escaped.
 */

import type { PropsWithChildren } from "hono/jsx";
import { fontFaceCss } from "./fonts.js";
import styles from "./site.css";

/** Icon paths, defaulted to what `flutter_launcher_icons` already emits into a
 * Flutter app's `web/` directory (see the
 * {@link https://eigeninteractive.com/docs/ship-it/branding | branding guide}).
 * An implementor who builds the app has these files already and copies them
 * into `public/`; nobody has to author a second icon set for the web. */
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
  /** Legal entity for the footer. Omitted → no footer, which is the case for a
   * worker running `deepLink` without `site`. */
  operatorName?: string;
}

/** The engine's footer: the legal links every page must carry, plus the
 * operator's copyright. Rendered only when `site` is configured, since the
 * legal routes do not exist otherwise. */
function Footer({ operatorName }: { operatorName: string }) {
  return (
    <footer>
      <span>
        &copy; {new Date().getUTCFullYear()} {operatorName}
      </span>
      <a href="/terms">Terms of Service</a>
      <a href="/privacy">Privacy Policy</a>
      <a href="/delete-account">Delete Account</a>
    </footer>
  );
}

export function Page(props: PropsWithChildren<PageProps>) {
  const siteName = props.siteName ?? props.title;
  return (
    <html lang="en" style={props.primaryColor === undefined ? undefined : `--primary:${props.primaryColor}`}>
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
        <link rel="icon" href={ICONS.favicon} />
        <link rel="apple-touch-icon" href={ICONS.appleTouch} />
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
          {props.operatorName !== undefined && <Footer operatorName={props.operatorName} />}
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
 * build-time file — never anything a user submits. */
export function RawHtml({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
