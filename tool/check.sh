#!/usr/bin/env bash
set -euo pipefail

platform_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_contracts() {
  node "$platform_root/tool/platform.mjs" --check
  node "$platform_root/tool/check-contracts.mjs"
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

check_changelog_links() {
  local changelog="$platform_root/flutter/CHANGELOG.md"
  local missing=0

  if grep -Fq '## \[' "$changelog"; then
    echo "Flutter changelog contains an escaped section heading" >&2
    return 1
  fi

  while read -r label; do
    if ! grep -Fq "[$label]:" "$changelog"; then
      echo "Flutter changelog section [$label] has no link definition" >&2
      missing=1
    fi
  done < <(grep -o '^## \[[^]]*\]' "$changelog" | sed 's/^## \[//; s/\]$//')

  [[ "$missing" -eq 0 ]]
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

  cd "$platform_root/server/clients/dart"
  dart analyze
  dart pub publish --dry-run

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

run_flutter() {
  check_changelog_links
  "$platform_root/tool/link-local-dart.sh"
  cd "$platform_root/flutter"
  flutter pub get
  dart format --output=none --set-exit-if-changed \
    $(git ls-files '*.dart' ':!:**/*.g.dart' ':!:**/*.freezed.dart' | sed 's#^flutter/##')
  dart run build_runner build
  dart fix --apply
  assert_no_drift "Flutter code generation" flutter
  flutter analyze
  dart doc --dry-run .
  flutter test
  flutter test --platform chrome test/core/api/game_socket_test.dart

  cd example
  flutter pub get
  dart format --output=none --set-exit-if-changed .
  flutter analyze
  flutter test
  flutter build web --release --dart-define-from-file=app-config.json
  test -f build/web/assets/packages/eigen_flutter/assets/vendor/cropperjs/cropper.min.js

  cd "$platform_root/flutter"
  dart pub publish --dry-run
}

run_web() {
  if [[ "${SERVER_ALREADY_BUILT:-0}" != "1" ]]; then
    build_server
    cd "$platform_root/server"
    pnpm --filter @eigeninteractive/server openapi
    assert_no_drift "OpenAPI generation" server/packages/server/openapi.json
  fi

  cd "$platform_root/web"
  pnpm check-docs-version
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
  pnpm -r build
  node packages/create-eigen-game/scripts/scaffold-e2e.mjs "$target"
}

case "${1:-all}" in
  contracts) run_contracts ;;
  server) run_server ;;
  flutter) run_flutter ;;
  web) run_web ;;
  scaffold) run_scaffold "${2:-all}" ;;
  all)
    run_contracts
    run_server
    run_flutter
    SERVER_ALREADY_BUILT=1
    run_web
    run_scaffold
    ;;
  *)
    echo "usage: $0 [all|contracts|server|flutter|web|scaffold]" >&2
    exit 64
    ;;
esac
