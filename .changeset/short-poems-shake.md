---
"@eigeninteractive/server": patch
---

Give the download page something to look at, and stop it offering links it cannot honour.

The page now leads with the app's own launcher icon, centres itself rather than
clinging to the top of an empty viewport, and ends in a footer on every page —
the operator's copyright and legal links when `site` is configured, and a credit
line either way. `site.madeByCredit` overrides that line or removes it with
`null`, mirroring the Flutter shell's `Branding.madeByCredit`.

Before a web build exists there is no app icon to show, so the EigenInteractive
mark stands in — inline SVG drawn in the page's own tokens, so it takes a
configured `primaryColor` and follows the visitor's colour scheme. A game with
neither a web build nor store URLs has nothing to offer at all, and now says
`Coming soon.` instead of ending after the tagline.

Two fixes behind it. The "Play on the web" button and the icon are now shown
only when a Flutter web build is actually deployed: the `ASSETS` binding is
bound from the first `wrangler dev` whether or not `public/` has anything in it,
so the button was sending visitors to `/`, which redirected straight back. And
`--on-primary` is now paired with `--primary` per colour scheme, computed from
luminance for a game that configures its own — white on the dark scheme's light
teal was the one pairing in the palette that failed contrast outright.
