---
sidebar_position: 4
title: The game's web surface
description: Deep-link files, share pages, opt-in avatars, and the generated site — a complete indexable website by configuration.
---

# The web surface — the game's website, deep links & avatars

The game Worker *is* the deep-link host, so app-link verification and the API
share one domain, one cert, one deploy.

## Deep links and share pages

- **App-link files** are **generated** from the `deepLink` config, not
  hand-maintained: `/.well-known/assetlinks.json` (Android App Links) and
  `apple-app-site-association` (iOS Universal Links, served extensionless as
  `application/json` — the content-type a static file gets wrong). One source of
  truth.
- **`/join/:shortCode`** and **`/game/:gameId`** are the two share/landing pages:
  they read the D1 summary for real OG tags (host + open seats for an invite; the
  roster and status for a game) so a shared link unfurls richly, and both are the
  *not-installed* fallback — an installed app opens the https URL directly via
  App/Universal Links, so these are only reached when the app is absent.
  `/game/:gameId` shows the roster for a **public** game only; a private game
  gets a generic card, since an unauthenticated page cannot authorize the viewer.

## Avatars

Avatars are opt-in R2. Uploads go through the Worker (R2 has no per-user access
control): a raw-binary `PUT /api/engine/me/avatar` (type/size-validated) stores
the image under key = uid, and a public `GET /avatars/:uid` serves it with a long
immutable cache. The stored `avatar_url` carries a `?v=<ts>` cache-buster since
the key is overwritten on re-upload. An optional `avatars.publicBaseUrl` points
the URL straight at a bucket custom domain, bypassing the Worker for reads — the
whole "serve from the bucket" flip is a config value, not a code change. The
default (worker-served) path is the only one that works on a zoneless
`workers.dev` deploy.

## The generated site

**The `site` block** generates the rest of the game's website: the landing page
(`/`), the three legal documents (`/terms`, `/privacy`, `/delete-account`), and
the crawler files (`/sitemap.xml`, `/robots.txt`, `/site.webmanifest`). The
point is that an implementor gets a complete, indexable, app-store-compliant
site by configuration — the alternative is every game hand-rolling the same
four pages and getting the store requirements subtly wrong.

**The pages are hono/jsx components.** hono is already a dependency, so this
adds no runtime — and it buys three things that were previously hand-rolled.
Interpolated values are escaped by the renderer rather than by an `esc()` helper
somebody can forget to call, which matters because user-controlled display names
reach the share page's OG tags. The stylesheet is a real `.css` file inlined at
build time, so it highlights and formats like CSS. And the default legal
documents take the required `operator` block as **typed props**, which replaced
an earlier `{{token}}` substitution scheme: a mistyped placeholder is now a
compile error, and the regex, the known-token set, and the fail-fast guard that
scheme needed are all gone.

An implementor overriding a legal document supplies an **HTML fragment**, not a
component — it is inserted as-is, with their own values already written in, so
they need no JSX and no props. HTML because the *other* override path — dropping
`public/terms.html`, which static-asset precedence makes win over the route — is
already HTML, so one format covers both. Documents render once at startup, never
per request.

:::info Batteries included, batteries removable

Every generated page is replaceable with **no configuration at all**: Cloudflare
serves a matching static asset before invoking the Worker, and default
`html_handling` resolves the extensionless `/terms` to `public/terms.html`. The
cost is that a `public/` file can shadow a route by accident.

:::

The whitelabel app's display name is a single required top-level `appName` on
`createEngine` — the one source of truth for engine-owned identity (the share
page title and OG tags, and the `site` landing page's default name; push copy
later), independent of which optional feature blocks are enabled.

The client-side counterpart — Android intent filters, iOS associated domains and
the asset pipeline — is in [Deep links & branding](../client/shipping.md).

## Configuring the `site` block

Point a domain at your Worker and the `site` block gives you the whole public web
surface — no templates to copy, no routes to register:

| Route | What it is |
|---|---|
| `GET /` | Landing page: name, tagline, screenshots, store buttons |
| `GET /terms`, `/privacy`, `/delete-account` | The legal documents |
| `GET /sitemap.xml`, `GET /robots.txt` | Crawler directives |
| `GET /site.webmanifest` | Web app manifest |

```ts
site: {
  tagline: "A hidden-information battle of wits for two players.",
  primaryColor: "#1a237e",
  screenshots: ["1.png", "2.png"],   // under public/screenshots/
  operator: {
    name: "Your Company Ltd",
    jurisdiction: "India",
    contactEmail: "hello@example.com",
    effectiveDate: "1 July 2026",
  },
},
```

The absolute URLs in canonical links, OG tags and the sitemap are built from the
**request origin** — no domain to configure. So that this stays the one canonical
host, disable the `workers.dev` route in production; the custom domain is then
the only host the worker answers on. Store buttons come from your `deepLink`
block, so store URLs are configured once. The landing page emits
`SoftwareApplication` JSON-LD with `applicationCategory: "GameApplication"`.

### Assets: your Flutter app already made them

The engine never generates images, but it doesn't ask you to draw any either —
its default paths are exactly the filenames `flutter_launcher_icons` emits into
the app's `web/` directory, all derived from the same `assets/icon/icon.png` the
app icon uses. Copy that output into `public/`:

```text
public/
  favicon.png                      # web/favicon.png
  og-image.png                     # web/og-image.png (1200×630, override with `ogImage`)
  icons/Icon-192.png               # web/icons/…
  icons/Icon-512.png
  icons/Icon-maskable-192.png
  icons/Icon-maskable-512.png
  screenshots/                     # optional, whatever you list in `screenshots`
```

`og-image.png` is the only hand-made file, and the client's
[branding assets](../client/shipping.md) already ask for it for the app's own
share card. Nothing here needs authoring twice.

:::warning Android App Links must be scoped

Because these pages sit on the same host as the app's deep links
(`/join/:code`, `/game/:id`), the app's `<intent-filter>` needs an
`android:pathPrefix` for each of `/join` and `/game` — `assetlinks.json`
verifies the whole host, so without the prefixes Android claims `/terms` too and
hands it to a router that has no such route. iOS is already scoped by the
generated AASA.

:::

### Legal documents

All three default to generic templates the engine ships. They take your
`operator` block as typed props — there are no placeholders to fill in and
nothing to keep in sync. They describe **only what the engine itself collects**:
accounts, display names, optional avatars, game history, ratings, friend
connections, push tokens and crash diagnostics.

:::danger Read them before you publish

They are a starting template, not legal advice, and you are the one on the hook
for what they say. If you add analytics, advertising, payments, or any other
processing, you must edit them. Two lines in particular assume things about your
app: the privacy policy's "Diagnostics" bullet assumes crash reporting, and the
delete-account steps describe the reference Flutter shell's Settings screen.

:::

To supply your own prose, pass an HTML **fragment** — body content only, since
the engine supplies the shell, styling and footer:

```jsonc
// wrangler.jsonc — lets you import .html files as strings
"rules": [{ "type": "Text", "globs": ["**/*.html"], "fallthrough": true }]
```

```ts
import terms from "./legal/terms.html";
// …
site: { /* … */ legal: { terms } },
```

Your fragment is inserted as-is, so write your own values into it directly.

**Overriding a whole page takes no config at all.** Cloudflare serves a matching
static asset *before* invoking your Worker, and the default `html_handling`
resolves `/terms` to `public/terms.html`. So shipping the file replaces the
generated page — same format as the config path. The flip side: never add a file
under `public/` whose path shadows a route you did not mean to replace
(`public/index.html` will silently replace your landing page).
