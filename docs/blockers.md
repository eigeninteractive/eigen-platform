# Upstream blockers

Limitations that still require a compatibility choice in the platform.
Last checked: **2026-11-02**. See [the dependency review](dependency-review-2026-11-02.md).

## Android built-in Kotlin and new DSL

**Status:** Keep `android.builtInKotlin=false` and `android.newDsl=false`.

These are independent blockers, verified with a fresh Flutter 3.47.9 app:

- With built-in Kotlin enabled and the legacy DSL retained, `in_app_review`
  2.0.12 fails at `android/build.gradle:25` because it unconditionally applies
  `kotlin-android`. It is still the latest published version; its last fix
  handles a background-Activity null pointer, not built-in Kotlin.
- With the new DSL enabled, Flutter's Gradle plugin fails while applying to the
  app: `ApplicationExtensionImpl` cannot be cast to `AbstractAppExtension`.
  Updating individual plugins cannot repair this SDK-side compatibility issue.

FlutterFire and `app_settings` already guard their Kotlin plugin application.
Their presence in Flutter's source-text warning is not evidence they still
block the migration. `image_cropper` 13 also removed its old DSL dependency.

Recheck the stable SDK and the published `in_app_review` Gradle script. Remove
these flags only after a fresh scaffold builds Android debug and release with
the corresponding migration enabled. Do not patch cached plugin sources or
force Gradle plugin versions across consumers.

References: [Flutter app migration](https://docs.flutter.dev/release/breaking-changes/migrate-to-built-in-kotlin/for-app-developers),
[in_app_review changelog](https://pub.dev/packages/in_app_review/changelog).

## Dart analyzer and generator graph

**Status:** Keep Freezed 4.0.1 and the resolvable analyzer-13 generator graph
with Flutter 3.47.9 / Dart 3.13.7.

The stable SDK still pins `test_api` 0.7.12 and matcher 0.12.20. Resolution
therefore selects test 1.31.1, whose analyzer constraint is below 14. Actual Pub
dry runs reject Freezed 4.0.3 and Dartdoc 9.0.11, which require analyzer 14 and
14.5 respectively. Upgrading the SDK patch does not unblock those tools.

There is also an independent build-system constraint: build_runner 2.17.1
requires build 5, while riverpod_generator 4.0.4 requires build below 5. The
resolved build_runner 2.16.1 and source_gen 4.2.4 are intentional, not missed
updates. Do not bypass these constraints with overrides.

The old root Dartdoc 9.0.8 workaround has been removed. With that dependency
absent, the pinned SDK's `dart doc --dry-run` succeeds for Flutter, shell and
Firebase, and a full Flutter documentation build produces an index. This is a
result for the current graph, not a claim that the SDK changed its Dartdoc
revision: Dart 3.13.5 and 3.13.7 still record the same upstream Dartdoc commit.

Other unavailable transitive majors remain owned by their dependents:
built_collection 6, cross_file 0.4, qr 4 and package_config 3 do not resolve in
this workspace. Re-evaluate their owners together with the SDK/generator graph,
instead of adding direct constraints on transitive implementation details.

References: [Freezed changelog](https://pub.dev/packages/freezed/changelog),
[Dartdoc changelog](https://pub.dev/packages/dartdoc/changelog),
[Flutter test pins](https://github.com/flutter/flutter/blob/3.47.9/packages/flutter_test/pubspec.yaml),
[build_runner](https://pub.dev/packages/build_runner),
[riverpod_generator](https://pub.dev/packages/riverpod_generator).

## TypeScript documentation toolchain

**Status:** Keep TypeScript 6.0.3 in `web/`. The server hold is removed.

tsdown 0.23.3 repaired stable TypeScript 7 support by selecting the compatible
declaration generator. The platform uses tsdown 0.23.4 and TypeScript 7.0.2 for
the server and generated Workers. The native compiler works without adding a
second compiler or opting into experimental TypeScript 7.1 APIs.

Web documentation has a separate npm graph: stable TypeDoc 0.28.20 accepts
TypeScript only through 6.0.x, and typedoc-plugin-markdown 4.14.1 requires
TypeDoc 0.28.x. There is no newer stable supported pair. Keep only the web
Dependabot TypeScript-major hold. Its TypeScript 6 compiler also checks the
server source while generating the cross-package documentation.

References: [tsdown 0.23.3](https://github.com/rolldown/tsdown/releases/tag/v0.23.3),
[TypeDoc releases](https://github.com/TypeStrong/typedoc/releases),
[Markdown plugin compatibility](https://typedoc-plugin-markdown.org/docs/CHANGELOG).

## Development-tool audit findings

**Status:** Stable owners still constrain affected dependencies. After compatible
transitive refreshes, `pnpm audit` reports zero root findings, one moderate
server finding, and sixteen web findings (2 critical, 7 high, 5 moderate, 2 low).
Counts are advisory counts, not distinct packages or deployed vulnerabilities.

| Owner | Remaining dependency | Why the update stops here |
| --- | --- | --- |
| drizzle-kit 0.31.11 | esbuild 0.18.20 through the deprecated esbuild-kit loader | The latest stable Kit still includes the loader. Drizzle 1.0 is an RC; changing a direct esbuild does not replace the loader's nested copy. |
| Docusaurus 3.10.2 and its bundler/dev server | tinypool 1.1.1, serialize-javascript 6.0.2, uuid 8.3.2 | Fixes need new major ranges from their owners. Docusaurus 4 remains canary. |
| docusaurus-plugin-llms 0.6.1 | minimatch 9.0.3, yaml 2.8.1 | The latest plugin pins these versions exactly. |
| OpenAPI docs 5.2.0 / Postman converter | yaml 1.10.2, js-yaml 4.3.0, older Faker | The latest supported owner graph still selects the affected versions. |
| TypeDoc 0.28.20 | minimatch 10 | The new advisory requires minimatch 11; the owner's range excludes it. |
| SVGR/SVGO through Docusaurus | deepmerge 4.3.1 | No patched stable deepmerge release is available. |

Joi is no longer held: refreshing the owner's compatible range selects 17.13.9,
which fixes the email-validation denial of service. Its high advisory is gone.
Hono's newly published router/security fixes are also taken explicitly through
the server's `^4.13.16` minimum, rather than only updating a development lockfile.

These remaining findings belong to development/build graphs rather than the
deployed Hono/Worker closure. They remain real maintenance work because tooling
processes repository inputs. Do not claim the full audit is clean or force
unrelated major versions with overrides merely to clear its report.
