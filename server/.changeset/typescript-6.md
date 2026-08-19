---
"@eigeninteractive/rules": patch
"create-eigen-game": minor
---

Build on TypeScript 6, and generate declarations with `tsc` instead of `tsup`.

The whole repository is now on TypeScript 6.0.x — the engine packages, the
scaffolder, the documentation site, and the `tsconfig.json` a scaffolded project
ships. The server workspace had been left on 5.9 with nothing recording why, and
the reason turned out not to be our code at all.

`tsup`'s declaration step injects `baseUrl` unconditionally
(`dist/rollup.js`: `baseUrl: compilerOptions.baseUrl || "."`). TypeScript 6
reports that as deprecated and fails the build with `TS5101`, for a setting no
config here sets; TypeScript 7 removes it altogether. Both are open upstream
against the latest release — egoist/tsup#1388 and #1389 — and `tsup` has had no
publish since 2025-11, with its author recommending `tsdown` instead. So the fix
could not come from a version bump.

Declarations now come from `tsc -p tsconfig.build.json` per package, which honours
the repository's own configuration and injects nothing. That removed the
repo-wide `ignoreDeprecations: "6.0"` an earlier attempt needed, which would have
silenced every other 6.0 deprecation as collateral. `tsup` keeps building the
JavaScript, where it is not in TypeScript's way.

For consumers the published types are equivalent, with one visible difference:
`dist` now carries a declaration file per module rather than one bundled
`index.d.ts`. Both are covered by `files`, both resolve under Node and bundler
resolution because the sources already use explicit `.js` specifiers, and the
generated TypeScript reference improves as a side effect — cross-package types
now cite `kernel/dist/ratings.d.ts` rather than a line number inside a bundle.
Declaration maps are no longer published, since they pointed at `src`, which
`files` does not ship.
