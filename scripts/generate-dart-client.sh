#!/usr/bin/env bash
#
# Regenerates `clients/dart` — the eigen_api Dart REST client — from
# packages/server/openapi.json.
#
# The client lives here, in the repo that owns the wire contract, and is
# published to pub.dev by the release workflow. That is deliberate: a breaking
# wire change then shows up as a reviewable Dart diff in the *same pull request*
# that changed the zod schema, instead of surfacing days later in another
# repository. The generated sources are committed for the same reason, and CI
# regenerates and diffs them so they can never lag the routes.
#
# Toolchain: pnpm (runs the generator via `pnpm dlx`) and a JDK on PATH (openapi-
# generator is a Java program), plus Dart (build_runner + format + publish, all
# needed here anyway).
#
# The generator is openapi-generator, run through its official npm wrapper with
# `pnpm dlx @openapitools/openapi-generator-cli`. The wrapper owns the one thing
# not worth hand-maintaining — downloading and version-pinning the JAR — reading
# the pin from ./openapitools.json. `pnpm dlx` runs it from an ephemeral isolated
# install rather than a workspace devDependency on purpose: added to the
# workspace, the wrapper breaks under pnpm's isolated linker (its build-script
# approval gate blocks the wrapper's self-install, and the wrapper's phantom
# `tslib` fails to resolve); dlx's throwaway install sidesteps both and leaves no
# devDependency behind. The JDK is provided by the environment (CI's setup-java,
# or your local install) — nothing here installs it.
#
# Everything under clients/dart is generated EXCEPT pubspec.yaml,
# analysis_options.yaml and .openapi-generator-ignore (which lists exactly those
# protected files). The pubspec is hand-owned because the dart-dio template
# stamps `sdk: >=3.5.0` while its own json_serializable output uses Dart 3.8
# null-aware elements — OpenAPITools/openapi-generator#21815.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPEC="$ROOT/packages/server/openapi.json"
OUT="$ROOT/clients/dart"

# The published version tracks the engine's. The wire contract is the server's,
# so a server major *is* a client major — and a consumer's `eigen_api: ^1.2.0`
# then carries exactly the compatibility statement it should.
VERSION="$(node -p "require('$ROOT/packages/server/package.json').version")"
echo "==> eigen_api version $VERSION (from @eigen/server)"

# Clearing lib/ and doc/ guarantees no orphan file survives a schema removal.
# dlx runs from ROOT so the wrapper reads the version pin in ./openapitools.json.
echo "==> generating (dart-dio + json_serializable)"
rm -rf "$OUT/lib" "$OUT/doc"
( cd "$ROOT" && pnpm dlx @openapitools/openapi-generator-cli generate \
  -i "$SPEC" -g dart-dio -o "$OUT" \
  --additional-properties=pubName=eigen_api,pubLibrary=eigen_api,serializationLibrary=json_serializable,skipCopyWith=true \
  --global-property=modelTests=false,apiTests=false,modelDocs=true,apiDocs=true )

# Stamp the version into the hand-owned pubspec, so `pnpm changeset version`
# and this script cannot disagree about what is being published.
echo "==> stamping version"
perl -pi -e "s/^version: .*/version: $VERSION/" "$OUT/pubspec.yaml"

# Build the serializers. These are committed too: a consumer never runs
# build_runner on a dependency, so a package whose `part 'x.g.dart';`
# directives point at nothing does not compile.
echo "==> build_runner"
( cd "$OUT" && dart pub get >/dev/null && dart run build_runner build --delete-conflicting-outputs >/dev/null )

# openapi-generator's output is not `dart format` clean, and these sources are
# committed — so format them here, in the script that owns the artifact.
# Formatting rather than excluding also normalises generator reflow, so a
# generator upgrade diffs as real changes instead of line-breaking churn.
echo "==> dart format"
( cd "$OUT" && dart format lib >/dev/null )

# pub.dev refuses to publish without a LICENSE, and renders CHANGELOG.md as a
# tab. Both are derived here rather than hand-maintained: the licence is the
# repository's, and this package has no changes of its own to describe — its
# version *is* the engine's.
echo "==> licence, changelog, README banner"
cp "$ROOT/LICENSE" "$OUT/LICENSE"

cat > "$OUT/CHANGELOG.md" <<EOF
# Changelog

This package is generated from the Eigen engine's OpenAPI specification and its
version tracks [\`@eigen/server\`](https://www.npmjs.com/package/@eigen/server)
exactly — $VERSION here is $VERSION there. It has no changes of its own.

See the engine's changelog:
<https://github.com/eigeninteractive/eigen-server/blob/main/packages/server/CHANGELOG.md>

A **major** bump means a breaking wire change. Generated enums parse strictly,
with no \`unknown\` sentinel, so a new member of any wire enum is breaking even
though it looks additive.
EOF

# Prepended rather than hand-owned, so the generator keeps the API/generator
# version lines below it current.
cat > "$OUT/README.tmp" <<'EOF'
> [!IMPORTANT]
> **Do not depend on this package directly.** It is a build artifact,
> regenerated wholesale on every wire change, and its surface is not designed
> for human use. Flutter apps depend on
> [`eigen_flutter`](https://pub.dev/packages/eigen_flutter), which re-exports
> the wire types a game needs and keeps the `*Api` classes out of your
> namespace.
>
> It is published only because pub.dev rejects path dependencies — the same
> reason Flutter's federated plugins publish `*_platform_interface` packages
> nobody imports. Documentation lives at
> <https://eigeninteractive.com/docs/reference/http-surface>.

EOF
cat "$OUT/README.md" >> "$OUT/README.tmp"
mv "$OUT/README.tmp" "$OUT/README.md"

echo "==> done: clients/dart @ $VERSION"
