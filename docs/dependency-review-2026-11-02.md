# Dependency and retained-hold review — 2026-11-02

This review starts from the four open Dependabot updates: actions #148,
Cloudflare tests #152, server dependencies #153, and documentation #154.
The isolated `codex/dependency-hold-review` branch includes their changes,
newer reviewed stable fixes, the required JWT type correction, and updated
scaffolding. It does not merge, close, or publish any of those pull requests.

## Changes and semantic decisions

| Dependency | Before → selected | What changed and how it applies |
| --- | --- | --- |
| Flutter / Dart | 3.47.7 / 3.13.5 → 3.47.9 / 3.13.7 | [Hotfix notes](https://github.com/flutter/flutter/blob/3.47.9/CHANGELOG.md): certificate-store security updates, Android's updatable trust store, and workspace native-assets test fixes. Framework and generated-app FVM pins move together. Existing apps need to rebuild with the patched SDK to receive runtime fixes. |
| TypeScript / tsdown | 6.0.3 / 0.23.2 → 7.0.2 / 0.23.4 for server | [0.23.3](https://github.com/rolldown/tsdown/releases/tag/v0.23.3) repairs stable TS7 declaration generation; [0.23.4](https://github.com/rolldown/tsdown/releases/tag/v0.23.4) adds build/config fixes. Use native `tsc`, ordinary compiler settings and the supported declaration path. The scaffolder's own compilation and generated Worker use TS7 too. Web keeps TS6 for TypeDoc. |
| jose | 6.2.13 → 6.2.15 | [6.2.14](https://github.com/panva/jose/releases/tag/v6.2.14) changes contextual payload inference, exposing #153's compile failure. Use the SDK's `JWTPayload` type; Google-specific claims remain `unknown` until the existing strict checks validate them. No cast, fallback or relaxed signature/issuer/audience/account checks. [6.2.15](https://github.com/panva/jose/releases/tag/v6.2.15) bounds decompression and rejects negative cache durations/clock tolerance; our verifier uses valid/default values. |
| Hono | 4.13.14 → 4.13.16 | [Security release](https://github.com/honojs/hono/releases/tag/v4.13.16): fixes middleware matching in the default router and other mount, form, CSS and CSRF paths. Raise the published minimum to `^4.13.16`, rather than only selecting it in a development lockfile. Keep the supported router; no workaround router is introduced. |
| Wrangler / workers-types / workerd | 4.153.0 / 5.20261026.1 / 1.20261023.1 → 4.156.1 / 5.20261101.1 / 1.20261101.1 | [4.154](https://github.com/cloudflare/workers-sdk/releases/tag/wrangler@4.154.0), [4.155](https://github.com/cloudflare/workers-sdk/releases/tag/wrangler@4.155.0), [4.156](https://github.com/cloudflare/workers-sdk/releases/tag/wrangler@4.156.0), [4.156.1](https://github.com/cloudflare/workers-sdk/releases/tag/wrangler@4.156.1): local binding errors retain codes, DO self-references resolve correctly, asset deployment stays within configured paths, OAuth callbacks validate state, and uploads retry transient errors. Regenerate Worker bindings. Explicit compatibility dates remain the declared runtime contract; a changed CLI default does not silently move them. |
| Cloudflare Vitest plugin | 1.4.8 → 1.4.12 | [1.4.11](https://github.com/cloudflare/workers-sdk/releases/tag/%40cloudflare/vitest-plugin%401.4.11) fixes a hang when handlers log from another I/O context and fixes self-referencing DO bindings; [1.4.12](https://github.com/cloudflare/workers-sdk/releases/tag/%40cloudflare/vitest-plugin%401.4.12) follows the current runtime. Vitest/coverage remain paired at 5.0.5. No configuration migration is required by this plugin patch. |
| Biome | 2.6.3 → 2.6.4 | [Release](https://github.com/biomejs/biome/releases/tag/%40biomejs%2Fbiome%402.6.4): migrate server, web and scaffold configs with the CLI. The template is explicitly a root configuration for the independent generated project; migrating its temporary copy as a nested config incorrectly added `root: false`, which the existing scaffold test caught. Keep Markdown/YAML generation under their owning tools. |
| Sass / sass-loader | 1.106.1 / 17.0.1 → 1.107.1 / 17.1.0 | [Sass 1.107](https://github.com/sass/dart-sass/releases/tag/1.107.0) adds deprecation selectors; [1.107.1](https://github.com/sass/dart-sass/releases/tag/1.107.1) fixes protocol reporting. [Loader 17.1](https://github.com/webpack-contrib/sass-loader/releases/tag/v17.1.0) resolves data resources correctly. Docusaurus uses the supported loader API; we do not configure the deprecated future-version selector or call legacy Sass APIs. |
| GitHub actions | setup-java 6.0.1 → 6.1.0; app-token 3.2.0 → 3.3.0 | [Java notes](https://github.com/actions/setup-java/releases/tag/v6.1.0): version-resolution and cleanup fixes. [Token notes](https://github.com/actions/create-github-app-token/releases/tag/v3.3.0): updated permission inputs and dependencies. Our Temurin 21 settings and contents/pull-request permissions are supported; removed team-discussion permissions are unused. Retain the token action's SHA pin. |
| Standalone Dartdoc | root dependency 9.0.8 → removed | After removing the dependency through Pub, SDK documentation checks pass on Flutter, shell and Firebase, and a full HTML generation produces an index. Use `dart doc --dry-run` in the gate. Do not replace this workaround with another analyzer pin. This result does not assert that the SDK changed its upstream Dartdoc revision. |

All dependency manifests and lockfiles are changed with pnpm, Pub, npm's
manifest CLI or FVM. Biome migrates its configuration. No dependency overrides
are introduced to force unsupported versions. Package versions are left to the
release workflows; a Changeset records the server and scaffolder release.

## Compatible transitive refresh

The full compatible refresh is deliberate: the initially green web PR still
selected Joi 17.13.8 even though its owner allowed the fixed 17.13.9.

- [Joi 17.13.9](https://github.com/hapijs/joi/compare/v17.13.8...v17.13.9)
  replaces quadratic email splitting and rejects prototype-named message keys.
  Its high advisory clears without overriding Docusaurus or selecting Joi 18.
- [Babel 7.29.12](https://github.com/babel/babel/releases/tag/v7.29.12),
  [SWC 1.16.21](https://github.com/swc-project/swc/compare/v1.16.20...v1.16.21)
  and [Rolldown 1.2.16](https://github.com/rolldown/rolldown/releases/tag/v1.2.16)
  fix parsing, lexical-loop/minifier semantics, side-effect preservation,
  inline-script escaping and build cleanup. Preserve the framework-supported
  transforms rather than enabling experimental bundler features.
- [PostCSS 8.5.32](https://github.com/postcss/postcss/releases/tag/8.5.32)
  fixes source locations, warnings and Promise behavior. CSS support data and
  browser mappings follow their existing owners; no browser policy changes.
- Markdown/HTML utilities fix template nodes, CSS property casing, directive
  fences, ampersands and escaping. The actual documentation regeneration and
  production build validate the resulting render pipeline. Upstream comparisons:
  [parse5 conversion](https://github.com/syntax-tree/hast-util-from-parse5/compare/8.0.3...8.0.4),
  [JSX conversion](https://github.com/syntax-tree/hast-util-to-jsx-runtime/compare/2.3.6...2.3.7),
  [directives](https://github.com/syntax-tree/mdast-util-directive/compare/3.1.1...3.2.0),
  [Markdown serialization](https://github.com/syntax-tree/mdast-util-to-markdown/compare/2.2.0...2.2.1).
- [Algolia 5.61](https://github.com/algolia/algoliasearch-client-javascript/releases/tag/5.61.0)
  masks keys in error stacks and changes host-state caching. This site uses local
  search and does not call the added A/B testing metrics API.
- [React Redux 9.3.1](https://github.com/reduxjs/react-redux/releases/tag/v9.3.1)
  fixes inference and subscription behavior. Our own web code does not use the
  deprecated `connect` API; its owning theme retains control of that dependency.
- [Postman conversion](https://github.com/PostmanLabs/openapi-to-postman/compare/v6.4.1...v6.4.2)
  trims operation-server trailing slashes. Redocly's browser-bundling fix is
  useful to the docs graph; its new experimental API-diff command is not needed
  by the existing contract generation/drift gate.
- [ws 8.22.1](https://github.com/websockets/ws/releases/tag/8.22.1) fixes IPC paths
  and uses supported Node masking helpers. The live Worker uses Cloudflare's
  native WebSocket API, not this development-server implementation.

## Holds that remain

See [blockers.md](blockers.md) for current owners, constraints and removal tests.

- Web TypeScript 7: stable TypeDoc and its Markdown plugin still exclude it.
- Analyzer 14, Freezed 4.0.3, source_gen 4.3.1 and newer build_runner: Pub dry
  runs fail against Flutter 3.47.9's test pins. The latest Riverpod generator
  still excludes build 5, independently blocking build_runner 2.17.1.
- Android built-in Kotlin: a fresh app fails at the published review plugin's
  unconditional Kotlin application. New DSL: a separate fresh-app probe fails
  inside Flutter's Gradle plugin. Retain the two flags for distinct reasons.
- Drizzle ORM 0.45.4 and Kit 0.31.11 are still latest stable. The Kit loader's
  vulnerable esbuild is not repaired by adding a newer direct esbuild. Moving
  to Drizzle 1.0 RC or Docusaurus 4 canary is a separate ecosystem migration.
  Drizzle RC does remove that loader, but its Kit requires the RC ORM and
  converts migration metadata/layout; the SQLite and query semantics also
  change. This is an available coordinated upgrade, rather than a claim that
  no upstream solution exists. [Upgrade guide](https://orm.drizzle.team/docs/upgrade-v1),
  [RC5 changes](https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v1rc5).
- Compatible root/server/web refreshes retain 3/1/16 audit findings respectively.
  Stable owner constraints still prevent the remaining fixes; the root findings
  include glob/minimatch major updates and an unpatched deepmerge release.

## Validation

The original #153 compiler error was reproduced from its exact lockfile.
The corrected verifier uses the SDK payload type and the existing security
checks. Initial TS7 build/typechecks and all 733 server-workspace tests passed.

SDK dry-run documentation passed all three packages without the root Dartdoc
dependency; a full Flutter HTML build generated `index.html`. Pub dry runs and
separate Android migration probes provide the negative evidence for retained
holds. No hosted infrastructure is used for these probes.

The complete `./tool/check.sh` gate passed after regenerating Worker types and
API docs, using Flutter 3.47.9 / Dart 3.13.7 and the selected TypeScript 7 graph:

- Server: 733 tests, builds, typechecks, OpenAPI/client/type generation,
  migration drift checks and npm publication dry runs.
- Dart: 191 client tests, 21 Chrome tests and 16 generator tests; analysis,
  Drift schema/code generation and package publication dry runs.
- Flutter: 175 framework and 37 example tests, generated-file checks, analysis,
  example release web build and service-worker precache validation.
- Shell/Firebase: 120 and 44 tests, analysis and publication dry runs.
- Fresh scaffold: actual CLI bootstrap, Worker analysis and 9 tests, Flutter
  analysis and 10 tests, Android release APK and web release/service worker.
- Web: reference generation without drift, typecheck and Docusaurus production
  build. SDK documentation dry runs passed all three Flutter packages.

The first full attempt exposed the template's accidental `root: false`; the
existing scaffold test failed. After correcting the standalone configuration,
the entire gate was rerun successfully. No test or check was disabled.

Existing non-failing warnings remain: OpenSkill's published package lacks a
referenced source map, and shell inherits an unresolved Riverpod `[state=]`
documentation link. The retained Android compatibility warnings are explained
by the independent migration probes above.
