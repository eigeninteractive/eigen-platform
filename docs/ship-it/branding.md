---
sidebar_position: 4
title: Branding & the website
description: One set of source images becomes the app icon, the splash, the web assets and the game's whole public website — plus the legal documents you must actually read.
---

# Branding & the website

Branding is app-owned: the engine ships none, because it has no app to ship. What
it does do is make **one set of source images** serve everything — the app icon,
the splash, the web assets, and the game's public website — so nothing is
authored twice.

Author the marks in any vector tool and export the PNG sources below; every
platform-specific size is generated from them.

## Replacing the placeholder artwork

A scaffolded game ships with the EigenInteractive mark and seed colour, so it
looks deliberate before you have drawn anything. Swapping in your own is these
seven steps, in this order — the later ones consume what the earlier ones write:

1. **Replace the sources** in `app/assets/icon/`: `icon.png` and
   `icon_foreground.png` at 1024 × 1024, and `splash.png` / `splash_dark.png`
   if your splash mark differs. See [the app icon](#the-app-icon) for what the
   foreground has to keep clear of.
2. **Match the colours in `app/pubspec.yaml`** —
   `flutter_launcher_icons.adaptive_icon_background` and every
   `flutter_native_splash` colour. [These cannot read Dart](#the-splash), so
   nothing keeps them in step with your theme but you.
3. **Regenerate**, from `app/`:

   ```bash
   dart run flutter_launcher_icons
   dart run flutter_native_splash:create
   ```

4. **Set the seed** in `app/lib/main.dart` — `Branding(seedColor: …)` — and, if
   you have configured a `site`, its `primaryColor` in `server/src/index.ts`.
   Material 3 rebuilds both schemes from the seed, so this one value is the
   app's whole palette.
5. **Draw the share card**: `app/web/og-image.png` at 1200 × 630, and fill in
   the [OG tags](#the-apps-web-build) in `app/web/index.html`. It is the only
   hand-made file in the pipeline.
6. **Build the web bundle**, from the repository root:

   ```bash
   pnpm run build:web
   ```

   This is the step that carries the regenerated icons into the Worker's
   `public/`, which is where the download page and the manifest read them from.
   Skip it and the website keeps showing the mark it had before.
7. **Commit the generated files.** Launcher icons, splash drawables and web
   icons are generated once and committed, not rebuilt on each build.

Everything below is the detail behind those steps.

## The app icon

Two 1024 × 1024 PNGs in `assets/icon/`. They are build-time inputs, so they are
*not* declared under `flutter: assets:`.

| File | Notes |
|---|---|
| `icon.png` | Full square icon, artwork edge-to-edge, opaque. Used for iOS, macOS, web and the legacy Android icon. iOS rejects alpha — set `remove_alpha_ios: true` if the source has any. |
| `icon_foreground.png` | Adaptive-icon foreground: the mark alone on **transparent**, inside the inner ~66%. Android masks it to a circle or squircle and parallaxes it, so anything near the edge is cropped. Also reused as the splash image. |

`dart run flutter_launcher_icons` writes the Android mipmaps and adaptive XML,
the iOS/macOS appiconsets, and the web favicon and icons plus the `icons` array
in `manifest.json`. It never touches `web/index.html`, and it does **not**
generate the [notification icon](./push.md#the-android-notification-icon).

## The splash

`flutter_native_splash:` is a **top-level** pubspec key, not nested under
`flutter:`. Reusing `icon_foreground.png` as the splash image keeps the splash
mark and the home-screen icon the same file. Regenerate with
`dart run flutter_native_splash:create` after any config or asset change.

Two things to know:

- **On Android 12+ the `image:` key is ignored entirely.** The platform builds
  the splash from the adaptive launcher icon, so the `android_12:` block only
  sets colours. And `-v31` is a *minimum*-version qualifier: that block covers
  API 31 and everything after, not just Android 12.
- **Colours cannot read Dart.** `color` / `color_dark` must be kept in sync by
  hand with the theme surfaces derived from `Branding.seedColor`; changing the
  seed means editing them and regenerating.

For a splash mark that differs from the launcher icon, add
`assets/splash/logo.png` (plus `logo_dark.png`) at 1152 × 1152 with artwork
inside the inner 640 px — the outer ring is cropped by Android 12's circular
mask.

## The app's web build

A fresh Flutter app ships template values that fail silently: `<title>` is the
project name, the description is "A new Flutter project.", and `manifest.json`
carries Flutter's default `#0175C2`. Replace all of them.

Flutter's web template also has **no Open Graph tags**, so a pasted link renders
as a bare URL. Add `og:*` and `twitter:*` to `<head>`, with `og:image` an
**absolute** URL at 1200 × 630 (`web/og-image.png`) — a relative `og:image` is
the usual reason a preview renders blank, since scrapers do not resolve them.
Keep text centred; some clients crop to a square. Verify with the Facebook
Sharing Debugger after deploying, and re-scrape after changes — both it and Slack
cache hard.

## The game's website

The Worker's `site` block generates the rest of the game's public web presence,
and **it consumes exactly the files above** — no second icon set, no extra
artwork:

| Route | What it is |
|---|---|
| `GET /` | Landing page: app icon, name, tagline, screenshots, store buttons |
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

The point is that you get a complete, indexable, store-compliant site by
configuration — the alternative is every game hand-rolling the same four pages
and getting the store requirements subtly wrong.

Absolute URLs in canonical links, OG tags and the sitemap are built from the
**request origin**, so there is no domain to configure. To keep one canonical
host, disable the `workers.dev` route in production. Store buttons come from your
`deepLink` block, so store URLs are configured once. The `/download` page emits
`SoftwareApplication` JSON-LD with `applicationCategory: "GameApplication"`.

Every page ends in a footer carrying your copyright, the three legal links, and
a credit line — `Made with ❤️ by EigenInteractive`, the same default the Flutter
shell's `Branding.madeByCredit` uses. Set `madeByCredit` to your own string, or
to `null` to drop it:

```ts
site: { /* … */ madeByCredit: null },
```

### Before `site` is configured

`/download` serves without it, so a game has a working web/native handoff from
the first deploy. What it does *not* have is the legal half: those routes are
not mounted, so the footer carries only the credit until you fill in `operator`.

The page also waits for a Flutter web build to reach `public/` before it shows
your app icon or a "Play on the web" button, because both would otherwise be
broken — the icons ship inside that bundle, and `/` would bounce straight back
to `/download`. Until then it stands the EigenInteractive mark in for the icon,
drawn in your `primaryColor`, exactly as the Flutter shell defaults to the
EigenInteractive seed and credit. Run `pnpm run build:web` and your own icon
replaces it.

A game with no web build *and* no store URLs in `deepLink` has nothing to offer
at all, and the page says `Coming soon.` rather than trailing off after the
tagline. That is the state a freshly scaffolded game is in, so seeing it on your
first `wrangler dev` is correct, not a misconfiguration.

### The web asset handoff

The root scaffold's `build:web` command writes Flutter's complete release
bundle directly into the Worker's `public/` directory. The engine's default
paths match the filenames `flutter_launcher_icons` emits:

| The app generates | Worker asset path | Used for |
|---|---|---|
| `web/favicon.png` | `favicon.png` | Browser tab |
| `web/icons/Icon-192.png` | `icons/Icon-192.png` | Manifest, apple-touch-icon |
| `web/icons/Icon-512.png` | `icons/Icon-512.png` | Manifest |
| `web/icons/Icon-maskable-192.png` | `icons/Icon-maskable-192.png` | Manifest (maskable) |
| `web/icons/Icon-maskable-512.png` | `icons/Icon-maskable-512.png` | Manifest (maskable) |
| `web/og-image.png` | `og-image.png` | Landing-page share card |

Screenshots go under `public/screenshots/`. `og-image.png` is the only hand-made
file in the whole pipeline, and the app's own share card already asks for it.

### Legal documents

All three default to templates the engine ships. They take your `operator` block
as **typed props**, so there are no placeholders to fill in and nothing to keep
in sync — a mistyped field is a compile error. They describe **only what the
engine itself collects**: accounts, display names, optional avatars, game
history, ratings, friend connections, push tokens and crash diagnostics.

:::danger[Read them before you publish]

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

:::info[Batteries included, batteries removable]

The scaffold reserves legal and `/download` paths with `run_worker_first`, so
Flutter's SPA fallback cannot shadow them. To replace generated legal prose,
use the typed `site.legal` fragments above.

:::

## Checklist

- [ ] `assets/icon/icon.png` + `icon_foreground.png` at 1024 × 1024, foreground
      inside the inner ~66%
- [ ] `flutter_launcher_icons:` adaptive background matches the brand →
      regenerate
- [ ] `flutter_native_splash:` colours match the theme → regenerate
- [ ] *(optional)* `ic_notification.xml` declared to override `eigen_flutter`'s
      default silhouette — notifications work without it
- [ ] `web/index.html`: real title, description and OG/Twitter tags, absolute
      `og:image`; `web/og-image.png` at 1200 × 630
- [ ] `web/manifest.json`: real `name`, `short_name`, `description`,
      `background_color` / `theme_color`
- [ ] `pnpm run build:web` places the complete Flutter bundle in Worker assets
- [ ] `site.operator` filled in, and the three legal documents actually read
- [ ] App Links `<intent-filter>` carries an `android:pathPrefix` for both
      `/join` and `/game` — see [Deep links](./deep-links.md)
