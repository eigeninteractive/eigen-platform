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

Both faces are served by the worker at versioned, immutable paths and declared
with `font-display: swap`, so nothing blocks the first paint and one fetch is
reused across every page, every game on the origin and every later session.
Nothing is requested from a font CDN, so an operator's domain gains no third
party. Together they are roughly 90KB of the worker's 3MB compressed budget,
subset to latin plus punctuation, currency and arrows.

Each face is committed twice: the `.woff2` a font tool can open, and a generated
`.ts` module holding its base64, which is what the worker imports. `pnpm run
fonts` regenerates the second from the first and `fonts:check` verifies it in
CI, so the two cannot drift. `tsup` could inline a `.woff2`, but
`vitest-pool-workers` resolves worker-side modules outside vite's plugin graph,
so the route would have answered 500 in the test suite while working in
production — the same reason `site.css` renders empty under test today.
