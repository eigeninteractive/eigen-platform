#!/usr/bin/env bash
set -euo pipefail

platform_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf '%s\n' \
  'dependency_overrides:' \
  '  eigen_api:' \
  '    path: ../server/clients/dart' \
  '  eigen_client:' \
  '    path: ../dart/eigen_client' \
  '  eigen_codegen:' \
  '    path: ../dart/eigen_codegen' \
  > "$platform_root/flutter/pubspec_overrides.yaml"

printf '%s\n' \
  'dependency_overrides:' \
  '  eigen_flutter:' \
  '    path: ../flutter' \
  '  eigen_api:' \
  '    path: ../server/clients/dart' \
  '  eigen_client:' \
  '    path: ../dart/eigen_client' \
  > "$platform_root/shell/pubspec_overrides.yaml"

printf '%s\n' \
  'dependency_overrides:' \
  '  eigen_flutter:' \
  '    path: ../' \
  '  eigen_shell:' \
  '    path: ../../shell' \
  '  eigen_firebase:' \
  '    path: ../../firebase' \
  '  eigen_api:' \
  '    path: ../../server/clients/dart' \
  '  eigen_client:' \
  '    path: ../../dart/eigen_client' \
  '  eigen_codegen:' \
  '    path: ../../dart/eigen_codegen' \
  > "$platform_root/flutter/example/pubspec_overrides.yaml"

printf '%s\n' \
  'dependency_overrides:' \
  '  eigen_flutter:' \
  '    path: ../flutter' \
  '  eigen_client:' \
  '    path: ../dart/eigen_client' \
  '  eigen_api:' \
  '    path: ../server/clients/dart' \
  > "$platform_root/firebase/pubspec_overrides.yaml"

printf '%s\n' \
  'dependency_overrides:' \
  '  eigen_api:' \
  '    path: ../../server/clients/dart' \
  > "$platform_root/dart/eigen_client/pubspec_overrides.yaml"

echo "Linked Flutter packages to the same-revision Dart clients."
