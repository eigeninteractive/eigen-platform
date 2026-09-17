#!/usr/bin/env bash
set -euo pipefail

platform_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The platform manifest: versions, package inventory, and cross-repo wiring. The
# portable schema profile is no longer checked here — it is enforced where it can
# be acted on, inside the contract emitter (`run_server`).
# The SDK's bundled `dart doc` crashes on any package whose dependencies carry
# `@docImport` doc comments (dartdoc's `_stripDocImports`, fixed upstream in
# 9.0.8, still unfixed in every current stable SDK). The workspace pins a fixed
# dartdoc instead; see the root pubspec.yaml. Run from the repository root with
# `--input` rather than from inside the package, because the pin is a dependency
# of the workspace root.
check_docs() {
  ( cd "$platform_root" && dart run dartdoc --no-generate-docs --input="$1" --output="$(mktemp -d)" )
}

run_manifest() {
  node "$platform_root/tool/check-dart-releases.mjs"
}

assert_no_drift() {
  local label="$1"
  shift

  if ! git -C "$platform_root" diff --exit-code -- "$@"; then
    echo "$label changed tracked generated files" >&2
    return 1
  fi

  local status
  status="$(git -C "$platform_root" status --porcelain --untracked-files=all -- "$@")"
  if [[ -n "$status" ]]; then
    echo "$label changed the generated file set:" >&2
    echo "$status" >&2
    return 1
  fi
}

build_server() {
  cd "$platform_root/server"
  pnpm -r build
}

run_server() {
  cd "$platform_root/server"
  pnpm exec biome ci .
  build_server
  pnpm -r typecheck
  pnpm -r test
  pnpm --filter @eigeninteractive/server fonts:check

  pnpm --filter @eigeninteractive/server openapi
  assert_no_drift "OpenAPI generation" server/packages/server/openapi.json

  pnpm --filter @eigeninteractive/server db:generate:d1 < /dev/null
  pnpm --filter @eigeninteractive/server db:generate:do < /dev/null
  assert_no_drift "Database migration generation" \
    server/packages/server/migrations \
    server/packages/server/src/do/migrations

  pnpm --filter rps exec wrangler types < /dev/null
  assert_no_drift "Worker type generation" \
    server/examples/rps/worker-configuration.d.ts

  pnpm dart-client
  assert_no_drift "Dart API generation" server/clients/dart
  # Generating the client is this shard's job; VALIDATING it is the flutter
  # shard's. `server/clients/dart` is a member of the workspace at the
  # repository root, and that workspace contains Flutter packages, so resolving
  # anything inside it needs the Flutter SDK -- which this shard deliberately
  # does not install. Generation itself still works on standalone Dart, because
  # `generate-dart-client.sh` strips `resolution: workspace` from its staging
  # tree and resolves there.

  cd "$platform_root/server"
  local pack_dir
  pack_dir="$(mktemp -d)"
  pnpm --filter @eigeninteractive/rules pack --pack-destination "$pack_dir"
  pnpm --filter @eigeninteractive/kernel pack --pack-destination "$pack_dir"
  pnpm --filter @eigeninteractive/server pack --pack-destination "$pack_dir"
  pnpm --filter @eigeninteractive/testkit pack --pack-destination "$pack_dir"
  pnpm --filter create-eigen-game pack --pack-destination "$pack_dir"
  pnpm --filter @eigeninteractive/rules publish --dry-run --no-git-checks
  pnpm --filter @eigeninteractive/kernel publish --dry-run --no-git-checks
  pnpm --filter @eigeninteractive/server publish --dry-run --no-git-checks
  pnpm --filter @eigeninteractive/testkit publish --dry-run --no-git-checks
  pnpm --filter create-eigen-game publish --dry-run --no-git-checks
}

# The Flutter and Dart subtree, as four independent shards.
#
# Split because they ARE independent, not because any one of them is slow:
# eight packages each paying resolve, format, analyze, test and a publish dry
# run add up to about ten minutes on a two-core runner, and CI can run them at
# once. Locally they stay sequential -- one workspace means one `pubspec.lock`
# and one `.dart_tool`, and concurrent `pub get` would race on both.

# The pure Dart packages, including the generated wire client.
#
# The client is validated here rather than in the server shard because
# resolving any member of this workspace needs the Flutter SDK. The server
# shard generates it and asserts it did not drift.
run_dart() {
  cd "$platform_root/server/clients/dart"
  flutter pub get
  dart analyze
  dart pub publish --dry-run

  cd "$platform_root/dart/eigen_client"
  flutter pub get
  dart format --output=none --set-exit-if-changed .
  # The device replica's Drift schema: the generated code, and the schema dump
  # every later schema version's migration is tested against.
  dart run build_runner build
  dart run drift_dev schema dump lib/src/replica/replica_database.dart drift_schemas/
  assert_no_drift "Replica code generation" \
    dart/eigen_client/lib \
    dart/eigen_client/drift_schemas
  dart analyze
  dart test
  dart test --platform chrome \
    test/api/game_socket_test.dart \
    test/local/rng_test.dart
  dart pub publish --dry-run

  cd "$platform_root/dart/eigen_codegen"
  flutter pub get
  dart format --output=none --set-exit-if-changed .
  dart analyze
  dart test
  dart pub publish --dry-run
}

# `eigen_flutter` and the example app that exercises it.
run_flutter() {
  cd "$platform_root/flutter"
  # The example is an independent app checked below. Avoid Flutter's implicit
  # example resolution so the core package check has one dependency graph.
  flutter pub get --no-example
  dart format --output=none --set-exit-if-changed \
    $(git ls-files '*.dart' ':!:**/*.g.dart' ':!:**/*.freezed.dart' | sed 's#^flutter/##')
  dart run build_runner build
  dart fix --dry-run
  assert_no_drift "Flutter code generation" flutter
  dart analyze lib
  dart analyze test
  flutter test

  cd "$platform_root/flutter/example"
  flutter pub get
  dart run eigen_codegen:generate_payloads \
    --contract ../../server/examples/rps/game-contract.json \
    --output lib/src/v1/payloads.dart \
    --fixtures-output test/fixtures
  assert_no_drift "Example payload generation" \
    flutter/example/lib/src/v1/payloads.dart \
    flutter/example/test/fixtures
  dart format --output=none --set-exit-if-changed .
  flutter analyze
  flutter test
  flutter build web --release --dart-define-from-file=app-config.json
  "$platform_root/node_modules/.bin/workbox" generateSW workbox-config.cjs
  test -f build/web/assets/packages/eigen_shell/assets/vendor/cropperjs/cropper.min.js
  # Drift's web runtime, shipped by eigen_flutter, and the Workbox worker that
  # precaches the build. Without them a browser has no persistence and no cold
  # start offline, which is the whole of offline play on the web, and the build
  # would still be green. The worker must precache the runtime and the entry
  # points by name, or it installs and still fails offline.
  for precached in \
    index.html \
    flutter_bootstrap.js \
    main.dart.js \
    assets/packages/eigen_flutter/assets/drift/sqlite3.wasm \
    assets/packages/eigen_flutter/assets/drift/drift_worker.js; do
    test -f "build/web/$precached"
    grep -q "\"$precached\"" build/web/sw.js
  done

  cd "$platform_root/flutter"
  dart pub publish --dry-run
}

# The optional packages above the core: the app shell and the Firebase adapter.
run_shell() {
  cd "$platform_root/shell"
  flutter pub get
  dart format --output=none --set-exit-if-changed \
    $(git ls-files --cached --others --exclude-standard '*.dart' \
      ':!:**/*.g.dart' ':!:**/*.freezed.dart')
  dart run build_runner build
  dart fix --dry-run
  assert_no_drift "Shell code generation" shell
  flutter analyze
  flutter test
  dart pub publish --dry-run

  cd "$platform_root/firebase"
  flutter pub get
  dart format --output=none --set-exit-if-changed \
    $(git ls-files '*.dart' | sed 's#^firebase/##')
  flutter analyze
  flutter test
  dart pub publish --dry-run
}

# Doc-comment references across the three Flutter packages.
#
# Its own shard because it is two minutes of pure compute that caches nothing
# and validates nothing the other shards depend on, so it has no business
# sitting on their critical path. One workspace resolve serves all three.
run_docs() {
  cd "$platform_root"
  flutter pub get
  check_docs flutter
  check_docs shell
  check_docs firebase
}

run_web() {
  if [[ "${SERVER_ALREADY_BUILT:-0}" != "1" ]]; then
    build_server
    cd "$platform_root/server"
    pnpm --filter @eigeninteractive/server openapi
    assert_no_drift "OpenAPI generation" server/packages/server/openapi.json
  fi

  cd "$platform_root/web"
  pnpm check-admonitions
  pnpm sync-api
  assert_no_drift "Documentation generation" \
    web/api/openapi.json \
    web/static/openapi.json \
    web/docs/reference/http-api \
    web/docs/reference/typescript
  pnpm exec biome ci .
  pnpm typecheck
  pnpm build
  test -s build/llms.txt
  test -s build/llms-full.txt
  test -s build/openapi.json
  test -s build/docs/intro.md
}

run_scaffold() {
  local target="${1:-all}"
  case "$target" in
    all|android|web) ;;
    *)
      echo "usage: $0 scaffold [all|android|web]" >&2
      return 64
      ;;
  esac

  cd "$platform_root/server"
  if [[ "${SERVER_ALREADY_BUILT:-0}" != "1" ]]; then
    pnpm -r build
  fi
  node packages/create-eigen-game/scripts/scaffold-e2e.mjs "$target"
}

case "${1:-all}" in
  manifest) run_manifest ;;
  server) run_server ;;
  dart) run_dart ;;
  flutter) run_flutter ;;
  shell) run_shell ;;
  docs) run_docs ;;
  web) run_web ;;
  scaffold) run_scaffold "${2:-all}" ;;
  all)
    run_manifest
    run_server
    # The four Dart shards share one workspace, so they run in sequence here
    # however they are sharded in CI: `pub get` and `build_runner` write the
    # same `pubspec.lock` and `.dart_tool`, and `assert_no_drift` reads a git
    # status two of them would be racing to change.
    (
      run_dart
      run_flutter
      run_shell
      run_docs
    ) & dart_pid=$!
    SERVER_ALREADY_BUILT=1 run_web & web_pid=$!
    SERVER_ALREADY_BUILT=1 run_scaffold & scaffold_pid=$!
    status=0
    wait "$dart_pid" || status=$?
    wait "$web_pid" || status=$?
    wait "$scaffold_pid" || status=$?
    exit "$status"
    ;;
  *)
    echo "usage: $0 [all|manifest|server|dart|flutter|shell|docs|web|scaffold]" >&2
    exit 64
    ;;
esac
