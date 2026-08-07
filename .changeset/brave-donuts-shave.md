---
"@eigeninteractive/server": minor
---

Give the engine-rendered public pages the EigenInteractive look: Space Grotesk
on headings and the call to action, and the Material 3 palette generated from
`Colors.teal` — the same seed the Flutter shell now defaults to, so a game that
has configured nothing reads as one product across its app and its pages.

The palette replaces three unrelated defaults: `#4f46e5` in the stylesheet,
`#6750a4` on `/download` and in the web manifest, and Material's baseline
neutrals, which were tinted for a purple brand. The neutrals here are
`ColorScheme.fromSeed` output too, which is why the greys are faintly green.

`--primary` also gets a dark-scheme value. It previously kept its light value on
a dark ground. A game that sets `site.primaryColor` still wins in both schemes —
that arrives as an inline style on the root element, which beats the stylesheet.

The display face is subset to latin plus punctuation, currency and arrows,
converted to woff2, and inlined into the stylesheet as a data URI: 20KB for the
whole 300–700 weight range, and no second round trip on a page that is usually
someone's first and only request. Nothing is fetched from a font CDN. Inter,
which the app uses for body text, is deliberately not inlined — it subsets to
72KB, and body copy on these pages stays on the system stack.
