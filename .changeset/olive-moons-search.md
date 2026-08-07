---
"create-eigen-game": minor
---

Give a generated project the lint, format and editor configuration the engine
uses on itself.

A scaffold shipped ninety files and no opinion about how they should be
formatted, so every editor did something different to them and an implementor's
first `format` would have rewritten code they never wrote. Projects now get
`biome.json` with this repository's rules, `.editorconfig`, and a `.vscode/`
that recommends the Biome extension and sets it as the formatter for the
languages it owns. `lint` and `format` scripts run from the repository root,
where Biome is installed. No language is exempted from formatting: nothing
generated depends on a comment surviving in a file a formatter may rewrite.

The Flutter half is excluded: `dart format` owns it.

A test scaffolds a project and runs Biome inside it, so the generated files are
held to the configuration they ship with. Its first run found two violations —
in the `biome.json` this change adds.

`pnpm-lock.yaml` at the root is no longer ignored. It described nothing when the
root had no dependencies; now that it pins Biome, it is a lockfile like any
other and is committed. Only the installed tree is ignored.
