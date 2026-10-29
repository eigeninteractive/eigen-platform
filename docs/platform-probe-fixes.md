# Platform probe fixes and dependency review

Reviewed 2026-10-27. The disposable Rival Courts game exists only to exercise
the actual scaffolder, engine, Dart client and Flutter web output.

## Design changes

1. A session is the complete committed view for an authenticated recipient.
   The command's acting seat is used for authorization and rule execution;
   it is not the response audience. Start responses now include the creator's
   frame, local bot commands retain the human recipient's projection, and
   rating transitions retain outcomes. HTTP, socket and cold reads agree for
   a recipient at the same sequence. The solo route no longer rereads after start.
   `GameRepository` owns delivery of all HTTP sessions into its serialized
   socket/gap pipeline; applications no longer manually inject responses.
2. The fixture output directory belongs entirely to the generator. Regeneration
   validates the contract, deletes the directory and writes the complete set.
   Check mode rejects missing, changed and extra files. No ownership manifest
   or distinction between generated and handwritten files is necessary.
   The CLI refuses a fixture directory containing its input or Dart output.
3. Every documented bot insert supplies the required millisecond `created_at`.
   The SQL was executed against all actual D1 migrations in an in-memory database.
4. Socket failures are visible. Transport and temporary service errors retry
   with backoff; permanent errors stop and show Retry. Riverpod does not add a
   second retry loop. A stopped connection replaces even a cached frameless
   snapshot with a persistent error and Retry; it does not retain a spinner or
   claim to be reconnecting. A duplicate revision on reconnect clears the error without
   replaying the move. Diagnostics retain the underlying HTTP status.

## Dependency decisions

Manifests and lockfiles were updated through `pnpm update`, `pnpm add/remove`,
`npm pkg`, `flutter pub add/upgrade`, and Corepack. Dart changelog entries use Cider.
No dependency overrides were added to force incompatible graphs.

| Dependency | Selected version | Changelog review and semantic use |
| --- | --- | --- |
| Flutter SDK | 3.47.7 / Dart 3.13.5 | [Hotfix changelog](https://github.com/flutter/flutter/blob/3.47.7/CHANGELOG.md): iOS accessibility/debugging and Windows stability fixes. Installed separately and pinned with FVM; generated apps inherit the same pin. |
| FlutterFire Core / Auth / Analytics / Crashlytics / Installations / Messaging | 5.1.0 / 7.0.1 / 13.0.1 / 6.0.1 / 0.5.1 / 17.0.1 | [Messaging changelog](https://pub.dev/packages/firebase_messaging/changelog): FID registration APIs are released. Use `register`, `onRegistered`, `onUnregistered` directly; remove four compatibility files. Retain native FID metadata and Installations for cleanup. Firebase BoM 35 requires Android 24, already the scaffold floor; Apple SDK 13 requires macOS 11. |
| flutter_local_notifications | 22.3.3 | [Changelog](https://pub.dev/packages/flutter_local_notifications/changelog): native fixes; existing named-argument initialization/show API remains current. |
| image_cropper | 13.0.0 | [Changelog](https://pub.dev/packages/image_cropper/changelog): modern Android DSL, iOS cropper update and independent freestyle handles. Enable resizable Android handles while preserving the square avatar ratio, matching iOS. |
| go_router | 18.1.1 | [Changelog](https://pub.dev/packages/go_router/changelog): shell navigation/semantics and asynchronous redirect fixes. Existing declarative routes and redirect APIs remain supported. |
| in_app_purchase_android | 0.5.5 | [Changelog](https://pub.dev/packages/in_app_purchase_android/changelog): Billing 9.1 requires Android 23, below our floor. Blocked Play Store now reports billingUnavailable. The adapter checks availability and maps generic purchase errors; it does not match the old numeric/string error. |
| cached_network_image | 4.0.5 | [Changelog](https://pub.dev/packages/cached_network_image/changelog): fixes web images after navigation and stale codec frames; existing widgets receive the fixes directly. |
| Drift / drift_dev | 2.35.3 / 2.35.2 | [Changelog](https://pub.dev/packages/drift/changelog): QueryRow data becomes read-only; our code only reads it. Worker JS and SQLite WASM are updated together to the matching runtime release. |
| web / code_builder / dart_style / json_serializable | 1.1.2 / 4.13.0 / 3.1.14 / 6.15.2 | [web](https://pub.dev/packages/web/changelog), [code_builder](https://pub.dev/packages/code_builder/changelog), [formatter](https://pub.dev/packages/dart_style/changelog), [serializer](https://pub.dev/packages/json_serializable/changelog): retain typed web APIs and regenerate all generated Dart output. |
| app_settings / in_app_review | 9.0.1 / 2.0.12 resolved | [Settings](https://pub.dev/packages/app_settings/changelog) guards built-in Kotlin; [review](https://pub.dev/packages/in_app_review/changelog) fixes background Activity handling but still applies KGP unconditionally. |
| Workbox | workbox-build 7.4.1 | Replace workbox-cli with the supported [Node generateSW API](https://developer.chrome.com/docs/workbox/modules/workbox-build), keeping the same precache configuration. Removes CLI watcher dependencies and the tmp override. Root audit reported zero vulnerabilities after replacement. |
| Biome | 2.6.3 | [Release](https://biomejs.dev/blog/biome-v2-6/): migrate configs to the current schema/preset. Explicitly exclude Markdown/YAML so the new formatters do not rewrite generated API docs or package-manager-owned lockfiles. |
| Wrangler / workers-types / Cloudflare Vitest plugin | 4.153.0 / 5.20261026.1 / 1.4.8 | [Cloudflare releases](https://github.com/cloudflare/workers-sdk/releases): regenerate Worker bindings; plugin fixes Vitest coverage/cache compatibility and updates pinned Zod/Undici security fixes. No new platform service or binding is required. |
| Vitest and coverage-v8 / tsdown | 5.0.5 / 0.23.2 | [Vitest](https://github.com/vitest-dev/vitest/releases), [tsdown](https://github.com/rolldown/tsdown/releases): keep test/coverage versions paired; compiler option fixes. TypeScript remains 6.0.3 after a real TS7 build failure. |
| Hono / jose / Zod / openapi3-ts | 4.13.14 / 6.2.13 / 4.6.7 / 4.6.2 | [Hono](https://github.com/honojs/hono/releases), [jose](https://github.com/panva/jose/releases), [Zod](https://github.com/colinhacks/zod/releases), [OpenAPI changelog](https://github.com/metadevpro/openapi3-ts/blob/master/Changelog.md): request/security/build fixes. Keep WebCrypto JWT verification and OpenAPI 3.1 contract generation; regenerate and compare artifacts. |
| React / React DOM / Sass / typedoc-plugin-markdown | 19.3.1 / 19.3.1 / 1.106.1 / 4.14.1 | [React](https://github.com/facebook/react/releases), [Sass](https://github.com/sass/dart-sass/blob/main/CHANGELOG.md), [TypeDoc plugin](https://typedoc-plugin-markdown.org/docs/CHANGELOG): runtime and renderer fixes. Docusaurus does not use the changed RSC protocol; retain supported stable TypeDoc 0.28.20. |
| pnpm | 12.15.0 | [Major migration](https://github.com/pnpm/pnpm/releases/tag/v12.0.0), [release](https://github.com/pnpm/pnpm/releases/tag/v12.15.0): strict workspace settings and deterministic peer-cycle resolution. Align project and CI pins; preserve explicit lifecycle-script approvals. |

Remaining compiler, documentation and Android Kotlin constraints are tracked in
[blockers.md](blockers.md). Other unresolved transitive majors are constrained by
their owners: built_value/build_runner keep built_collection 5; share_plus keeps
cross_file 0.3; qr_flutter keeps qr 3; the Flutter SDK pins platform and material
color utilities. No transitive dependency is forcibly overridden.

## Transitive dependency review

`pnpm update --depth Infinity` refreshed compatible lockfile ranges in server
and web. Changelogs/release notes were checked by upstream project; native
platform variants share their compiler's notes. These are the behavior changes
that affect our consumers:

- [Vite 8.3.5](https://github.com/vitejs/vite/blob/v8.3.5/packages/vite/CHANGELOG.md),
  [SWC 1.16.20](https://github.com/swc-project/swc/releases/tag/v1.16.20),
  [Babel 7.29.11](https://github.com/babel/babel/releases/tag/v7.29.11) and
  [webpack 5.112.2](https://github.com/webpack/webpack/releases/tag/v5.112.2)
  fix parsing, generated code and module invalidation. We retain the framework's
  supported build configuration; experimental package maps and type stripping
  are not prerequisites for these fixes.
- [PostCSS 8.5.31](https://github.com/postcss/postcss/blob/8.5.31/CHANGELOG.md)
  hardens source-map loading and fixes CSS escaping. Sass-loader 17.0.1 preserves
  the modern compiler default while fixing BOM placement. Browser/Unicode data,
  selector parsers and minifiers update through their owning toolchain.
- [Algolia 5.60](https://github.com/algolia/algoliasearch-client-javascript/blob/main/CHANGELOG.md)
  includes breaking changes to A/B testing and Agent Studio in a minor release.
  This site uses local search, neither API. DocSearch 4.7.1 and autocomplete
  1.19.12 stay within Docusaurus's supported ranges; no DocSearch 5 migration is
  forced into its wrapper.
- [Redocly 2.70/2.71](https://redocly.com/docs/cli/changelog) changes its standalone
  `build-docs` command and reader telemetry. This repository uses the OpenAPI
  core parser through Docusaurus, not that command; its published docs remain
  Docusaurus output. OpenAPI-to-Postman 6.4 adds 3.2 support, while our normative
  contract remains OpenAPI 3.1.
- Redux Toolkit 2.13 preserves its exports while moving build tools. Reselect
  5.3 removes experimental autotracking and adds bounded memoization; we do not
  import that removed API. These arrive through the OpenAPI documentation UI.
- Markdown/MDX AST traversal gains exit visitors and parser fixes. Markdown-it
  14.3.3 and SVGO 3.3.5 backport security fixes without forcing their consumers
  across unsupported major boundaries. The generation drift gate and full
  documentation build check the resulting output.
- Express/body-parser/proxy, YAML, URI, websocket and Undici updates include
  input-validation and resource-exhaustion fixes. They are consumed through
  development tools; the authoritative game server continues to use Hono and
  Workers WebCrypto. Remaining exact upstream pins are listed in blockers.

For some small transitive packages, no version-specific release notes could be
located after checking repository/release pages; and their owning package's supported
range was preserved. No application-level migration was invented for an API we
do not call. The reviewed Cloudflare security releases were less than pnpm's
default release age: its CLI recorded exclusions for those exact versions only,
without disabling the age policy globally.

## Validation

`./tool/check.sh` completed the server and fresh-scaffold checks. The first
combined run stopped its Dart shard on a local macOS analyzer-cache failure.
The crash reports identify `CODESIGNING / Invalid Page` in the generated plugin
AOT cache; moving only that regenerable binary and depfile aside let Flutter
3.47.7 rebuild them. Analysis then passed. The affected shards were rerun using
`./tool/check.sh dart`, `flutter`, `shell`, `docs`, and `web`.

- Server: 732 tests across rules, kernel, server, testkit, scaffolder and RPS;
  typechecking, OpenAPI/client/type generation, migration drift and package
  dry runs passed.
- Dart: 190 client tests, 21 Chrome tests and 16 codegen tests passed, including
  HTTP/socket arrival ordering, recovery and generated-directory cleanup.
- Flutter: 175 framework tests and 37 example tests passed, with analysis,
  generated-file checks, release web output and Workbox precache verification.
- Shell/Firebase: 120 shell tests and 44 Firebase tests passed, including
  registration events/account changes and persistent connection-error UI.
- Fresh scaffold: actual CLI bootstrap, Worker typecheck/9 tests, Flutter
  analysis/10 tests, Android release APK and Flutter web release with service
  worker passed. No hosted service was deployed.
- Documentation: TypeScript/HTTP references regenerate without drift; the
  Docusaurus typecheck and production build passed. Dart doc-comment validation
  passed for Flutter, shell and Firebase; shell reports one non-blocking
  unresolved `[state=]` reference inherited from Riverpod 3.4.3.
- Actual Rival Courts Flutter web: two players joined and started a private
  game, hid simultaneous choices and received the same terminal result.
  Missing socket configuration showed one persistent error with Retry and no
  spinner; restoring configuration and clicking Retry restored the game.
  Solo play created a server-bot match, resolved a round and accepted forfeit.
- Real HTTP probe: public/private start responses exactly match the immediate
  same-sequence read; idempotent creation, private-card projection, unchanged-
  view simultaneous actions, changed-view rejection, seat authorization,
  contiguous replay, and a complete seven-round bot match passed.

Evidence remains under the disposable game's `evidence/after-*` files; the
original pre-fix evidence and report were preserved.
Real Firebase push delivery requires configured Firebase/APNs credentials;
registration logic tests and scaffold builds do not establish delivered pushes.
