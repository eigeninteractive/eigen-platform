# Bundled fonts

`inter.ts` and `space-grotesk.ts` are generated: each exports one base64 string,
the woff2 bytes of a variable face subset for the public pages. `../fonts.ts`
serves them and generates the matching `@font-face` rules.

The same two faces the Flutter shell bundles, so a game's app and its pages
agree. Space Grotesk covers weights 300–700, Inter 100–900; neither italic is
included, because nothing on these pages sets one.

## Why TypeScript and not `.woff2`

`tsup` can inline a binary as base64 through its loader map, and that is how
`site.css` reaches the worker. It does not survive testing: `vitest-pool-workers`
resolves worker-side modules outside vite's plugin graph, so a loader-provided
import is empty under test. For the stylesheet that shows up as pages rendering
unstyled in the suite; for a font it would be a route that answers 500 in every
test while working in production.

A vite `load` plugin, a vite `transform` plugin, a workerd `Text` module rule
and a wrangler `rules` entry were all tried. None reach it; wrangler's `rules`
are documented as not applying under the Vite plugin. A string literal in a
`.ts` file is the one representation every pipeline agrees on.

## Regenerating

The `.woff2` is the source of truth; the `.ts` beside it is generated from it
by `scripts/encode-fonts.mjs` and verified in CI, so the two cannot drift.

Download the family from Google Fonts ([Inter], [Space Grotesk]) and take the
`*-VariableFont_*.ttf` from the top level of the archive, not from `static/`.
Then subset, convert, and re-encode:

```sh
pip install fonttools brotli

python3 -m fontTools.subset Inter-VariableFont_opsz,wght.ttf \
  --unicodes=U+0000-00FF,U+2010-2027,U+2030-205E,U+20A0-20BF,U+2122,U+2190-2199 \
  --layout-features=kern,liga,calt,tnum \
  --flavor=woff2 --output-file=src/site/fonts/inter.woff2

pnpm run fonts
```

Then bump `VERSION` in `../fonts.ts`, since the URLs are served `immutable`, so a
returning visitor keeps the old bytes for a year otherwise.

The subset is latin, punctuation, currency and arrows. `tnum` is kept because
the share page renders game codes. Inter's `opsz` axis is retained and nothing
sets it, so it rests at its default of 14, the text optical size.

The docs site serves the same two files from its own `static/fonts/`. They are
separate repositories, so nothing enforces that. Replace both together.

Both faces are SIL Open Font License 1.1; the notices are in `OFL-Inter.txt` and
`OFL-SpaceGrotesk.txt`.

[Inter]: https://fonts.google.com/specimen/Inter
[Space Grotesk]: https://fonts.google.com/specimen/Space+Grotesk
