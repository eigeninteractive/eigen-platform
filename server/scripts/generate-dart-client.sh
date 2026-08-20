#!/usr/bin/env bash
#
# Regenerates the OpenAPI contract from the server route graph, then regenerates
# `clients/dart`, the eigen_api Dart REST client, from that contract.
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
# not worth hand-maintaining (downloading and version-pinning the JAR) reading
# the pin from ./openapitools.json. `pnpm dlx` runs it from an ephemeral isolated
# install rather than a workspace devDependency on purpose: added to the
# workspace, the wrapper breaks under pnpm's isolated linker (its build-script
# approval gate blocks the wrapper's self-install, and the wrapper's phantom
# `tslib` fails to resolve); dlx's throwaway install sidesteps both and leaves no
# devDependency behind. The JDK is provided by the environment (CI's setup-java,
# or your local install); nothing here installs it.
#
# Everything under clients/dart is generated EXCEPT pubspec.yaml,
# analysis_options.yaml and .openapi-generator-ignore (which lists exactly those
# protected files). The pubspec is hand-owned because the dart-dio template
# stamps `sdk: >=3.5.0` while its own json_serializable output uses Dart 3.8
# null-aware elements. See OpenAPITools/openapi-generator#21815.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPEC="$ROOT/packages/server/openapi.json"
OUT="$ROOT/clients/dart"
STAGE="$(mktemp -d "$ROOT/clients/.eigen-api.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: $1 is required to generate eigen_api" >&2
    return 1
  fi
}

# macOS does not put Android Studio's bundled JDK on PATH. Flutter developers
# commonly already have this JDK, so use it before asking them to install a
# second runtime. Explicit JAVA_HOME always wins.
if ! java -version >/dev/null 2>&1 && [[ "$(uname -s)" == "Darwin" ]]; then
  android_studio_jdk="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  if [[ -x "$android_studio_jdk/bin/java" ]]; then
    export JAVA_HOME="$android_studio_jdk"
    export PATH="$JAVA_HOME/bin:$PATH"
  fi
fi

require_command node
require_command pnpm
require_command dart
if ! java -version >/dev/null 2>&1; then
  echo "error: Java 21+ is required by OpenAPI Generator." >&2
  echo "Install a JDK, or set JAVA_HOME. On macOS, Android Studio's bundled JDK is detected automatically when installed in /Applications." >&2
  exit 1
fi

java_version_output="$(java -version 2>&1)"
java_major="$(awk -F'[\".]' '/version/ { print $2 }' <<<"$java_version_output")"
if [[ ! "$java_major" =~ ^[0-9]+$ ]] || (( java_major < 21 )); then
  echo "error: Java 21+ is required; found Java ${java_major:-unknown}. Set JAVA_HOME to a supported JDK." >&2
  exit 1
fi

# The hand-owned package files must exist in the staged tree before generation:
# the checked-in ignore file protects them from the dart-dio template.
cp "$OUT/pubspec.yaml" "$STAGE/pubspec.yaml"
cp "$OUT/analysis_options.yaml" "$STAGE/analysis_options.yaml"
cp "$OUT/.openapi-generator-ignore" "$STAGE/.openapi-generator-ignore"

# The published version tracks the engine's, read from the same package.json
# field changesets owns (and that `emit-openapi.mjs` stamps into the spec's
# `info.version`). The wire contract is the server's, so a breaking server
# release *is* a breaking client release, and a consumer's `eigen_api: ^0.1.0`
# then carries exactly the compatibility statement it should.
#
# Pre-1.0, "breaking" lives in the MINOR position: `^0.1.0` resolves to
# `>=0.1.0 <0.2.0`, so 0.1.x is additive and 0.2.0 is the break.
VERSION="$(node -p "require('$ROOT/packages/server/package.json').version")"
echo "==> eigen_api version $VERSION (from @eigeninteractive/server)"

# Never generate a fresh-looking client from a stale checked-in contract. The
# route graph is the source of truth; OpenAPI and Dart are consecutive derived
# artifacts owned by this one command.
echo "==> emitting OpenAPI from server routes"
( cd "$ROOT" && pnpm --filter @eigeninteractive/server openapi >/dev/null )

# Generate and validate completely off to the side. The checked-in client is not
# touched until every fallible generator/build/format step has succeeded.
# dlx runs from ROOT so the wrapper reads the version pin in ./openapitools.json.
echo "==> generating (dart-dio + json_serializable)"
( cd "$ROOT" && pnpm dlx @openapitools/openapi-generator-cli generate \
  -i "$SPEC" -g dart-dio -o "$STAGE" \
  --additional-properties=pubName=eigen_api,pubLibrary=eigen_api,serializationLibrary=json_serializable,skipCopyWith=true,enumUnknownDefaultCase=true \
  --global-property=modelTests=false,apiTests=false,modelDocs=true,apiDocs=true )

# Stamp the version into the hand-owned pubspec, so `pnpm changeset version`
# and this script cannot disagree about what is being published.
echo "==> stamping version"
perl -pi -e "s/^version: .*/version: $VERSION/" "$STAGE/pubspec.yaml"

# Build the serializers. These are committed too: a consumer never runs
# build_runner on a dependency, so a package whose `part 'x.g.dart';`
# directives point at nothing does not compile.
echo "==> build_runner"
( cd "$STAGE" && dart pub get >/dev/null && dart run build_runner build --delete-conflicting-outputs >/dev/null )

# openapi-generator's output is not `dart format` clean, and these sources are
# committed, so format them here, in the script that owns the artifact.
# Formatting rather than excluding also normalises generator reflow, so a
# generator upgrade diffs as real changes instead of line-breaking churn.
echo "==> dart format"
( cd "$STAGE" && dart format lib >/dev/null )

# pub.dev refuses to publish without a LICENSE, and renders CHANGELOG.md as a
# tab. Both are derived here rather than hand-maintained: the licence is the
# repository's, and this package has no changes of its own to describe: its
# version *is* the engine's.
echo "==> licence, changelog, README banner"
cp "$ROOT/LICENSE" "$STAGE/LICENSE"

cat > "$STAGE/CHANGELOG.md" <<EOF
# Changelog

This package is generated from the Eigen engine's OpenAPI specification and its
version tracks [\`@eigeninteractive/server\`](https://www.npmjs.com/package/@eigeninteractive/server)
exactly: $VERSION here is $VERSION there. It has no changes of its own.

See the engine's changelog:
<https://github.com/eigeninteractive/eigen-platform/blob/main/server/packages/server/CHANGELOG.md>

While the engine is pre-1.0, a breaking wire change bumps the **minor**. A
constraint of \`^0.1.0\` resolves to \`>=0.1.0 <0.2.0\`, so 0.1.x is additive and
0.2.0 is the break. From 1.0.0 on it is the major, as usual.

Generated enums include an \`unknownDefaultOpenApi\` sentinel so an installed
client can decode enum members introduced by a newer server. The sentinel is
read-side compatibility only: serialising it emits
\`unknown_default_open_api\`, which is not a value accepted by the API.
EOF

# Prepended rather than hand-owned, so the generator keeps the API/generator
# version lines below it current.
cat > "$STAGE/README.tmp" <<'EOF'
> [!IMPORTANT]
> **Do not depend on this package directly.** It is a build artifact,
> regenerated wholesale on every wire change, and its surface is not designed
> for human use. Flutter apps depend on
> [`eigen_flutter`](https://pub.dev/packages/eigen_flutter), which re-exports
> the wire types a game needs and keeps the `*Api` classes out of your
> namespace.
>
> It is published only because pub.dev rejects path dependencies, the same
> reason Flutter's federated plugins publish `*_platform_interface` packages
> nobody imports. Documentation lives at
> <https://eigeninteractive.com/docs/reference/http-surface>.

EOF
cat "$STAGE/README.md" >> "$STAGE/README.tmp"
mv "$STAGE/README.tmp" "$STAGE/README.md"

echo "==> installing staged client"
rm -rf "$OUT/lib" "$OUT/doc"
mv "$STAGE/lib" "$OUT/lib"
mv "$STAGE/doc" "$OUT/doc"
for file in README.md CHANGELOG.md LICENSE build.yaml pubspec.yaml; do
  cp "$STAGE/$file" "$OUT/$file"
done

echo "==> done: clients/dart @ $VERSION"
