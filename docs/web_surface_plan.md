# Web surface & documentation plan

Design doc, 2026-07-23. Covers two things that were previously tangled together in
the `eigeninteractive-web` Worker:

1. **The game-side web surface** — everything a deployed game serves on its own
   host (landing page, legal pages, SEO files), shipped *inside the engine* so any
   implementor gets it by configuration rather than by hand.
2. **`eigeninteractive.com`** — the company site: landing, showcase, and the
   documentation product.

Part 1 (the engine `site:` surface) is **shipped**; Part 2 (`eigen-web`) is not
built yet. The Part 1 sections below carry dated "Revised" notes where the
implementation departed from the original sketch — read those as authoritative
over the older prose beneath them.

## Decisions

| Decision | Choice |
|---|---|
| Repo topology | Four repos, no monorepo. Local multi-root workspace for ergonomics. |
| `eigeninteractive-web` | Archived. Worker logic moves into the engine; content moves to `eigen-web`. |
| `strategy` | Left alone as an old reference. Not migrated in this work. |
| Legal pages | hono/jsx components with typed props; implementors override with a plain HTML fragment. |
| Legal defaults | Generic prose parameterised by the `operator` block — never an operator's real policy. |
| Legal host | One `APP_HOST`; per-game legal on the game's own host. No separate `LEGAL_HOST`. |
| Delete-account | A document describing the in-app steps. No dedicated endpoint or flow. |
| Dart API reference | Link out to pub.dev's auto-generated docs. Not self-hosted. |
| Docs versioning | Deferred until v1 is public. |
| Authored prose | Stays in the code repos; `eigen-web` pulls it at build time. |

## Repo topology

| Repo | Owns | Ships to |
|---|---|---|
| `eigen-server` | TS engine (`kernel`/`rules`/`server`/`testkit`) **plus the game-side web surface** | npm |
| `eigen-flutter` | `eigen_sdk` / `eigen_flutter` / `eigen_api` | pub.dev |
| `eigen-web` | `eigeninteractive.com` — landing, showcase, docs, changelog | Cloudflare |
| `strategy`, future games | Rules, `createEngine`, config, brand assets | Cloudflare |

Not a monorepo: pnpm and pub do not compose over one tree, the three artifacts have
different consumers and release cadences, and implementors consume published
artifacts rather than the repo. The one real cross-repo coupling — the wire
contract — is already handled by `openapi.json` → `generate_api.sh` plus the
twin-fixture drift tests. `eigen_interactive.code-workspace` already provides the
local monorepo feel.

---

# Part 1 — The engine's `site:` surface

**SHIPPED 2026-07-23.** An optional feature block on `createEngine`, alongside
`deepLink` and `avatars`, following the same seam: absent means the routes are
never mounted. Implemented in `src/routes/site.ts`, `src/site/html.ts`,
`src/site/legal.ts` and `src/site/legal/*.html`; covered by `test/site.spec.ts`.

**Revised 2026-07-23 after review.** Three things the first cut got wrong, all
now fixed: hand-rolled HTML escaping, a hand-written stylesheet embedded in
TypeScript, and `{{token}}` substitution. All three collapsed into **hono/jsx** —
already a dependency, so no new runtime. JSX escapes interpolated values; the
stylesheet is a real `site.css` inlined by the text loader; and the legal
defaults are components taking typed props, which deleted `fillLegalTokens`, the
token regex, `LEGAL_TOKENS`, and the fail-fast guard outright. Overrides stay
plain HTML fragments, so implementors never touch JSX.

**Asset paths now match the Flutter app's output.** `flutter_launcher_icons`
already emits `web/favicon.png` and `web/icons/Icon-{192,512}.png` (+ maskable)
from the same source the app icon uses, and `client_reference.md` §22 already
prescribes `web/og-image.png`. The engine's defaults are those exact names, so
an implementor copies a folder rather than authoring a second icon set.

**Android App Links must be path-scoped.** Serving `/terms` on the game host
collides with App Links, which verify the *whole* host — the app would intercept
its own legal links. Fixed on the client side by scoping the intent-filter to
the app's two deep-link prefixes, `android:pathPrefix="/join"` and
`.../game` (iOS mirrors this in the AASA `paths` entry), documented in
`client_reference.md` §21.

**`LEGAL_HOST` is gone — one `APP_HOST` now.** Legal pages are per-game and
served by the same worker on the game's own host; the path-scoped intent-filter
keeps them out of the app. The client's separate `legalHost` field was removed
(`legalPageUrl` now takes `appHost`). An implementor who wants a shared
cross-game legal domain still can — just point the app's links there — but it is
no longer a distinct config field.

**Renamed `/j/` → `/join/`** (clearer, and it already matched the client's
generated invite links). The share/landing route, the AASA `paths`, the
`robots.txt` disallow and all docs moved with it. The app's second prefix
`/game/:id` (replay + push deep links) was already established and is unchanged;
both now appear in the AASA as `["/join/*", "/game/*"]`.

Two details settled during implementation, both worth keeping:

- **Static-asset precedence is verified, not assumed.** Default `html_handling`
  (`auto-trailing-slash`) serves `public/terms.html` for `/terms` with a 200, and
  assets are checked before the worker — so the override path works with no
  config. `/terms.html` and `/terms/` both 307 to `/terms`.
- **`.html` defaults need no wrangler rule from implementors.** tsup inlines them
  with a `.html` text loader, exactly as it already did for drizzle's `.sql`
  bundle. A `Text` module rule is needed only to import one's *own* override.

## Configuration

```ts
export interface SiteConfig {
  /** Public game name in titles and OG tags. Defaults to `appName`. */
  name?: string;
  /** One-sentence hook. Meta description and OG description on the landing page. */
  tagline: string;
  /** Longer landing-page prose. Falls back to `tagline`. */
  description?: string;
  /** Hex accent driving the landing page and `theme-color`, e.g. "#1a237e". */
  primaryColor: string;
  /**
   * Canonical origin, e.g. "https://strategy.eigeninteractive.com". Required:
   * sitemap entries, canonical links and OG URLs must be absolute, and the
   * worker cannot infer the public origin from a proxied request.
   */
  canonicalOrigin: string;
  /** Filenames under `public/screenshots/`, rendered as a scroll carousel. */
  screenshots?: string[];
  /** Path under `public/` to the 1200x630 OG image. Default "/og.png". */
  ogImage?: string;
  operator: OperatorConfig;
  legal?: LegalConfig;
}

export interface OperatorConfig {
  /** Legal entity publishing the game. Fills `{{operator}}`. */
  name: string;
  /** Governing jurisdiction. Fills `{{jurisdiction}}`. */
  jurisdiction: string;
  /** Support and privacy contact. Fills `{{contact}}`. */
  contactEmail: string;
  /** Effective date of the legal documents. Fills `{{effectiveDate}}`. */
  effectiveDate: string;
}

export interface LegalConfig {
  /**
   * HTML fragment — body content only, no document wrapper; the engine supplies
   * the shell and styling. Each defaults to the engine's generic template.
   */
  terms?: string;
  privacy?: string;
  deleteAccount?: string;
}
```

`operator` is required whenever `site` is present, because the default legal
templates cannot render without it.

## Routes mounted

All outside `/api`, all unauthenticated, none in the OpenAPI document — matching
how `links.ts` already behaves.

| Route | Source | Cache-Control |
|---|---|---|
| `GET /` | Landing page rendered from `SiteConfig` | `public, max-age=3600` |
| `GET /terms` | `legal.terms` HTML | `public, max-age=3600` |
| `GET /privacy` | `legal.privacy` HTML | `public, max-age=3600` |
| `GET /delete-account` | `legal.deleteAccount` HTML | `public, max-age=3600` |
| `GET /sitemap.xml` | Generated | `public, max-age=86400` |
| `GET /robots.txt` | Generated | `public, max-age=86400` |
| `GET /site.webmanifest` | Generated from `SiteConfig` | `public, max-age=86400` |

Already shipped and unchanged: `GET /join/:shortCode`, `GET /.well-known/assetlinks.json`,
`GET /.well-known/apple-app-site-association`.

`robots.txt` allows `/`, disallows `/join/`, `/game/` and `/api/`, and emits a `Sitemap:` line
pointing at `canonicalOrigin`. `sitemap.xml` lists `/`, `/terms`, `/privacy` and
`/delete-account` only — share pages are ephemeral and already `noindex`.

The landing page emits: title, meta description, canonical link, the OG set
(`type`, `site_name`, `url`, `title`, `description`, `image` + dimensions), a
Twitter summary-large-image card, and `SoftwareApplication` JSON-LD with
`applicationCategory: "GameApplication"` — a game page, not an organisation page.

## Override precedence is free

Cloudflare checks static assets before falling through to the Worker (the reason
no `run_worker_first` entry is needed today). So an implementor who ships
`public/terms.html` silently wins over the generated `/terms`, with no config flag
and no engine involvement. Batteries included, batteries removable.

*To verify at implementation time:* that the default `html_handling` serves
`terms.html` for the extensionless path `/terms`. If it does not, the override
story needs an explicit config escape hatch instead.

## Legal content pipeline

**Format: HTML fragments. No markdown, no parser, no dependency.**

Markdown was the earlier plan; it was dropped for three reasons. It would have
meant a second format — the `public/terms.html` override path described above is
*already* HTML, so markdown in config would document two formats for one job.
The authoring gain is small and one-time on documents that use about six tags
(`h1`/`h2`, `p`, `ul`/`li`, `a`, `strong`) and are edited once, while the
dependency and format boundary are permanent. And HTML makes the trust model
explicit: operator-authored, build-time, served as-is, with no user-generated
path to sanitise.

Plain text was also considered and rejected — legal documents need headings,
lists and a `mailto:` contact link, and inferring those from whitespace is a
markdown parser by another name.

Note for the record that bundle size was *not* the reason. Worker size limits are
3 MB gzipped on the free plan and 10 MB paid; `marked` gzips to roughly 12 KB,
which is immaterial. The relevant limit is the **1 second Worker startup budget**
for global scope, where Cloudflare's guidance is explicit: avoid expensive work at
the top level and move initialization to build time. Parsing at module scope runs
against that, and once the parse moves to build time the shipped artefact is HTML
anyway.

`react-markdown` never applied here regardless — the game Worker is Hono/TS with
no React.

**Flow.** The engine ships `terms.html`, `privacy.html` and `delete-account.html`
as text modules, via a Wrangler module rule:

```jsonc
"rules": [{ "type": "Text", "globs": ["**/*.html"], "fallthrough": true }]
```

`import terms from "./legal/terms.html"` yields a plain string. `LegalConfig`
defaults to the engine's copies. An implementor wanting different prose copies the
file, edits it, adds the module rule to their `wrangler.jsonc`, and passes their
own import. An implementor wanting a wholly different page instead drops
`public/terms.html` and skips the engine entirely — same format either way.

**If the prose outgrows hand-written HTML**, author markdown in the engine repo
and convert with `marked` as a *devDependency* during the `tsup` build.
Implementors still receive HTML, so nothing about their setup changes. Not worth a
build step for three short documents today.

**Token substitution.** The default templates carry `{{operator}}`,
`{{jurisdiction}}`, `{{contact}}`, `{{effectiveDate}}` and `{{appName}}`, filled
from `OperatorConfig`. This is a string replace, not a parse, so it runs once at
module scope for negligible startup cost. Substitution must **fail fast at
startup** on any
unrecognised or unreplaced token — a page that renders the literal string
`{{foo}}` to a user is worse than a deploy that refuses to start.

**The default prose describes only what the engine itself collects**: accounts and
display names, optional avatars, game history, ratings, friend relationships and
push tokens. It must not assert anything about analytics, ads or payments, since
the engine does none of those. The implementor guide will carry a prominent note
that the defaults are a starting template requiring the operator's own legal
review — the operator, not the engine, carries the liability.

## Explicitly out of scope

OG image generation (implementor supplies `public/og.png`), favicon generation
(implementor supplies the conventional PNG set that the generated manifest
references), analytics, i18n, and any redirect-to-canonical-legal-URL mode. That
last one is unnecessary: our own games get identical correct pages simply by
sharing `operator` config and the engine defaults.

## Implementor setup, end to end

1. Point a route at the Worker in `wrangler.jsonc`.
2. Add the `site:` block to `createEngine`.
3. Drop `og.png`, the favicon set and any screenshots into `public/`.
4. Optionally copy and edit the legal HTML.

---

# Part 2 — `eigen-web`

Renamed from `eigen-docs` (done). Serves the apex and `www`; absorbs everything
still load-bearing in `eigeninteractive-web`.

## Cloudflare configuration

The C3 scaffold is already correct — Cloudflare's official Docusaurus framework
guide specifies static assets only: `assets.directory: "./build"`, **no `main`
field and no Worker code**. Two additions needed:

- `assets.not_found_handling: "404-page"` (Docusaurus emits a `404.html`)
- the apex `routes` block, moved off the old Worker

## Structure

```
eigen-web/
  docusaurus.config.ts
  sidebars.ts
  wrangler.jsonc            # assets: ./build; apex + www routes
  src/pages/index.tsx       # company landing
  src/pages/showcase.tsx    # games built on the engine
  docs/                     # synced in at build; gitignored
  blog/                     # changelog and release notes
  static/                   # brand assets, favicons, OG images, legal
  scripts/sync-docs.mjs     # pulls guides from the sibling repos
```

## Documentation pipeline

| Source | Tool | Result |
|---|---|---|
| `openapi.json` | `docusaurus-plugin-openapi-docs` | Generated MDX reference pages |
| `@eigen/server` TS | `docusaurus-plugin-typedoc` + `typedoc-plugin-markdown` | TypeDoc run inside the Docusaurus build |
| Dart packages | none | Link out to pub.dev's auto-generated docs |
| Authored guides | `scripts/sync-docs.mjs` | Copied from `eigen-server/docs` and `eigen-flutter/docs` |

`docusaurus-plugin-openapi-docs` (PaloAltoNetworks) is actively maintained and has
been updated for the Docusaurus 3.10 Tabs refactor and Redocly openapi-core v2.

Dart needs no build wiring at all: `dart doc` emits static HTML rather than
markdown, so it could never join the sidebar — but pub.dev generates and hosts
API docs for every published package, so publishing `eigen_sdk` and
`eigen_flutter` gives us hosted reference docs for free.

**Authored prose stays in the code repos.** Doc edits then land in the same commit
as the code change, which is the only way exhaustive docs stay true, and the files
remain available as agent context. `eigen-web` reads sibling checkouts locally and
clones at a pinned ref in CI.

One cleanup while doing this: `client_reference.md` currently lives in
`eigen-server` but documents the Flutter shell. It belongs in `eigen-flutter`.

## Search

`@cmfcmf/docusaurus-search-local`. It uses Algolia's open-source autocomplete UI
but contacts no third-party server, keeping the site self-contained; Algolia
DocSearch approval has also become difficult to obtain. The index is built at
build time, which is fine at this size.

## Sidebar — Diátaxis

Four quadrants: tutorial, how-to, reference, explanation. The existing docs map
onto it directly — `architecture.md` is explanation, `building_a_game.md` is
tutorial plus how-to, `client_reference.md` is reference.

```
Getting started      What Eigen is · First game (RPS walkthrough) · Deploy to Cloudflare
How-to guides        Rules & versions · Bots · Deep links · Game site & legal ·
                     Avatars · Rate limiting · Push · Account deletion
Explanation          Architecture · Kernel & observations · DO lifecycle ·
                     Policy in TS vs integrity in SQL
Reference            HTTP API · TypeScript · Dart (pub.dev) · Wire error codes · Config
```

**Gotcha:** Docusaurus 3.9+ requires unique `key` attributes on nav items sharing
a label, and this sidebar has three items labelled "Reference". Without keys this
errors rather than warns.

**No versioned docs yet.** Docusaurus's own guidance reserves versioning for
high-traffic sites with rapid inter-version doc churn; before v1 it only adds
build time and complexity.

## What moves from `eigeninteractive-web`

| Item | Destination |
|---|---|
| `terms.html`, `privacy.html`, `delete-account.html` | Prose becomes the seed for the engine's generic templates and the company legal pages |
| Favicons, `apple-touch-icon`, `site.webmanifest`, `home.og.png` | `eigen-web/static/` |
| `handleHome()` game cards | `src/pages/showcase.tsx`, from a games manifest |
| `handleAssetLinks`, `games.ts`, `sitemap.ts`, `landing-page.ts` | Deleted — superseded by the engine |
| `docs/adding-a-game.md` | Deleted — describes the obsolete subdomain-map workflow |
| `test/index.spec.ts` | Deleted — still the untouched C3 "Hello World" template |

---

# Migration sequence

1. **Unblock routing.** Drop `*.eigeninteractive.com/*` from the old Worker so game
   subdomains can claim their own routes. (More specific routes beat wildcards, so
   this is tidiness rather than a hard blocker.)
2. **Build the engine `site:` surface.** The largest piece of work.
3. **Move the apex** to `eigen-web`; port legal prose and brand assets; archive
   `eigeninteractive-web`.
4. **Wire the doc generators** last — they need the engine API to have settled.

Each step is independently shippable; nothing after step 1 blocks anything else.

# Known gaps carried over

- Per-game OG images were never produced. Landing pages referenced
  `/{subdomain}.og.png` while only `home.og.png` exists, so strategy's share cards
  currently show a broken image.
- `public/screenshots/` never existed; the carousel has never rendered.
- The old `robots.txt` disallowed `/join/` and `/game/`, both stale — the live
  share path is `/join/`.
