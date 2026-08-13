#!/usr/bin/env bash
set -euo pipefail

platform_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

run_server() {
  cd "$platform_root/server"
  pnpm lint
  pnpm typecheck
  pnpm test
}

run_flutter() {
  cd "$platform_root/flutter"
  flutter analyze
  flutter test
  cd example
  flutter test
}

run_web() {
  cd "$platform_root/web"
  pnpm check-docs-version
  pnpm check-admonitions
  pnpm typecheck
  pnpm build
}

run_server
run_flutter
run_web
