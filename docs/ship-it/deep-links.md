---
sidebar_position: 3
title: Deep links
description: The Worker generates the verification files and the app declares the same host, three places that must agree, and the path prefixes that stop the app swallowing its own legal pages.
---

# Deep links

The game Worker **is** the deep-link host, so app-link verification and the API
share one domain, one certificate, one deploy. Getting this right is mostly a
matter of the same host being declared in every place that needs it, and the
failure mode is silent, so the checklist at the end is worth actually running.

## What the Worker provides

- **The verification files are generated** from the `deepLink` config, not
  hand-maintained: `/.well-known/assetlinks.json` (Android App Links) and
  `apple-app-site-association` (iOS Universal Links, served extensionless as
  `application/json`, the content-type a static file usually gets wrong). One
  source of truth, regenerated on deploy.
- **`/join/:shortCode` and `/game/:gameId`** are native app links and Flutter
  web routes.
  They read the D1 summary for real Open Graph tags (host and open seats for an
  invite, roster and status for a game), so a shared link unfurls richly. They
  An installed app intercepts the HTTPS URL before it reaches the server. A
  browser receives the Flutter SPA at that same route, and a crawler reads the
  dynamic metadata from the same HTML response. There is no user-agent branch.
  `/game/:gameId` shows the roster for a **public** game only; a private game
  gets a generic card, because an unauthenticated page cannot authorise a viewer.

The `deepLink` block must carry the **release** signing certificate's SHA-256,
not the upload key's, and not the debug key's.

## What the app must declare

The app owns **two path prefixes** on this host: `/join/{code}` for invites and
`/game/{id}` for replay links and push-notification taps. Everything else the
Worker serves there (`/`, `/download`, `/terms`, `/privacy`,
`/delete-account`) is
deliberately *not* claimed, so it opens in the browser.

The host is compiled into the binary, because the OS verifies domain ownership at
install time. So it lives in **three places that must stay in sync**:

1. **`app/app-config.json`**: `"APP_HOST": "mygame.example.com"`. Pass the
   file to Android and web builds with
   `--dart-define-from-file=app-config.json`.
2. **`android/app/src/main/AndroidManifest.xml`**: `android:host` **and an
   `android:pathPrefix` for each of `/join` and `/game`** in the App Links
   `<intent-filter>`. Android fetches
   `https://<host>/.well-known/assetlinks.json` at install; a mismatch silently
   falls back to the browser.
3. **`ios/Runner/Runner.entitlements`**: `applinks:mygame.example.com`. **The
   entitlements file alone is not enough**: open Xcode → Runner target → Signing
   & Capabilities and confirm Associated Domains lists it. If it looks stale,
   remove and re-add it.

iOS needs no separate path step; the Worker's generated AASA already scopes
Universal Links to `paths: ["/join/*", "/game/*"]`.

:::warning[The Android path prefixes are not optional]

`assetlinks.json` declares `handle_all_urls`, so the **host** is verified as a
whole and the `<intent-filter>` is the only thing deciding which paths the app
claims. Without the prefixes the app claims **every** path on the host,
including the Worker's `/terms`, `/privacy` and `/delete-account`, and hands
them to a router that has no such route.

Because the host is baked into the binary, fixing that needs a new app release.

:::

## Legal pages live on the same host

They used to need a different domain, for exactly the reason above: App Links
covered the whole of `APP_HOST`, so a `/terms` URL built on it was intercepted
and handed to a router with no such route. Two things removed that constraint:
the Worker's `site` config serves the legal pages on the game's own host, and the
scoped intent-filter claims only `/join` and `/game`. Legal URLs therefore fall
outside the claimed paths and open in the browser.

If you would rather host legal pages elsewhere, say one canonical policy shared
across several games, just point the app's links there. Nothing in the
engine requires them to be on `APP_HOST`.

## Coordinating a change

**Android and iOS changes require a new app release** (the host is baked in);
Worker changes take effect on deploy. Ship the app change first, or accept a
window where links fall through to the browser.

Verify before submitting:

- [ ] The [Google Digital Asset Links validator](https://developers.google.com/digital-asset-links/tools/generator)
      resolves `https://<host>/.well-known/assetlinks.json`.
- [ ] An AASA validator resolves `https://<host>/apple-app-site-association` and
      reports it as `application/json`, not redirected.
- [ ] The SHA-256 in `deepLink` matches the **release** signing keystore.
- [ ] The iOS Team ID matches.
- [ ] The `<intent-filter>` carries both path prefixes.

The usual failures are a fingerprint that does not match the signing keystore, an
iOS Team ID mismatch, or the verification file being served through a redirect.
