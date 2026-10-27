# Upstream blockers

Limitations that still require a compatibility choice in the platform.
Last checked: **2026-10-27**. Remove entries when their workaround is removed.

## Android built-in Kotlin migration

**Status:** Still blocked by `in_app_review` 2.0.12.

The upgraded FlutterFire packages and `app_settings` 9.0.1 now guard their
Kotlin Gradle Plugin application when AGP built-in Kotlin is enabled.
`in_app_review` still unconditionally applies `kotlin-android`. Keep Flutter's
default compatibility opt-out until that plugin supports built-in Kotlin.
The Flutter warning scans source text, so its list can include plugins whose
application is already correctly guarded; inspect the resolved Gradle code.

`image_cropper` 13 also removes its old Android DSL dependency. Do not switch
all apps to the new DSL/Kotlin together until the remaining plugin supports it.
Then generate a fresh scaffold and build Android debug and release with both
compatibility flags removed before deleting this entry.

References: [Flutter app migration](https://docs.flutter.dev/release/breaking-changes/migrate-to-built-in-kotlin/for-app-developers),
[in_app_review source](https://github.com/britannio/in_app_review/blob/master/in_app_review/android/build.gradle),
[app_settings changelog](https://pub.dev/packages/app_settings/changelog).

## Dart documentation and analyzer toolchain

**Status:** Keep `dartdoc: 9.0.8` and Freezed 4.0.1 with Flutter 3.47.7 / Dart 3.13.5.

The SDK's bundled dartdoc revision is still `9.0.6-wip`; it crashes parsing
`@docImport` comments inherited from dependencies. The root's pinned 9.0.8
contains the offset fix, and `tool/check.sh` invokes that version explicitly.

Newer dartdoc (9.0.11) and Freezed (4.0.3) need analyzer 14. The SDK's
`flutter_test` pins matcher 0.12.20, resolving test 1.31.1 / test_core 0.6.18,
which require analyzer below 14. Build runner 2.17.1, build 5 and source_gen
4.3.1 are also outside this compatible graph. Do not override these constraints:
they represent compiler API compatibility, not a cosmetic solver obstacle.

When a stable Flutter SDK relaxes the test stack, resolve the complete workspace
again, regenerate all packages, and run tests and documentation checks. Remove
the dartdoc dependency only after the SDK's own `dart doc` succeeds on Flutter,
shell and Firebase packages.

References: [dartdoc changelog](https://pub.dev/packages/dartdoc/changelog),
[Freezed changelog](https://pub.dev/packages/freezed/changelog),
[Dart SDK DEPS](https://github.com/dart-lang/sdk/blob/main/DEPS).

## TypeScript 7 declaration generation and documentation

**Status:** Keep TypeScript 6.0.3 in server, generated Workers and web docs.

A real build with TypeScript 7.0.2 and tsdown 0.23.2 fails because the stable
native compiler does not provide the classic TypeScript compiler API used by
rolldown-plugin-dts. Its native declaration generator needs TypeScript 7.1+;
that compiler line is currently experimental. Do not add a second TypeScript
compiler or weaken declaration generation to make a version number advance.

The docs have an independent constraint: stable TypeDoc 0.28.20 supports
TypeScript through 6, and typedoc-plugin-markdown 4.14.1 requires TypeDoc 0.28.x.
Recheck both pipelines before removing the Dependabot TypeScript major hold.

References: [TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/),
[rolldown-plugin-dts](https://github.com/sxzz/rolldown-plugin-dts#readme),
[TypeDoc releases](https://github.com/TypeStrong/typedoc/releases).

## Development-tool audit pins

**Status:** Stable upstream releases still carry affected dependencies.
After compatible transitive updates and Cloudflare 4.153.0 / plugin 1.4.8,
`pnpm audit` reports zero findings in the root Workbox graph, one moderate
finding in server tools, and fourteen in web tools (2 critical, 7 high,
4 moderate, 1 low). Counts are advisory counts, not distinct packages.

| Owner | Remaining dependency | Why the update stops here |
| --- | --- | --- |
| drizzle-kit 0.31.11 | esbuild 0.18.20 through the obsolete esbuild-kit loader | Stable Drizzle Kit still includes the loader; a newer direct esbuild does not replace its nested copy. |
| Docusaurus 3.10.2 | tinypool 1.1.1; serialize-javascript 6.0.2; uuid 8.3.2 | Fixes require majors selected by the framework/minifier/socket owners. Docusaurus 4 is canary, not stable. |
| docusaurus-plugin-llms 0.6.1 | minimatch 9.0.3; yaml 2.8.1 | Latest stable plugin pins these exact versions. |
| OpenAPI docs 5.2.0 / Postman tools | yaml 1.10.2; js-yaml 4.3.0; faker 5.5.3 | Latest supported converter/collection graph still pins the older packages. |

These are development/build graphs, not the deployed Hono/Worker dependency
closure. That distinction does not make the findings resolved: tooling still
processes repository inputs. Recheck the owners' releases and audit when they
update; do not report the full repository audit as clean or force unrelated
major versions with overrides merely to clear the report.
