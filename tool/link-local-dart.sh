#!/usr/bin/env bash
set -euo pipefail

platform_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf '%s\n' \
  'dependency_overrides:' \
  '  eigen_api:' \
  '    path: ../server/clients/dart' \
  > "$platform_root/flutter/pubspec_overrides.yaml"

printf '%s\n' \
  'dependency_overrides:' \
  '  eigen_api:' \
  '    path: ../../server/clients/dart' \
  > "$platform_root/flutter/example/pubspec_overrides.yaml"

echo "Linked Flutter packages to the same-revision eigen_api client."
