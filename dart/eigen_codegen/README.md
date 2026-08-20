# eigen_codegen

Development-only code generation for EigenInteractive game contracts.

Add `eigen_codegen` as a development dependency, then generate the immutable
Dart payload types and version-specific `GameRules` bases used by your game:

```sh
dart run eigen_codegen:generate_payloads \
  --contract ../server/game-contract.json \
  --output lib/game/generated/payloads.dart \
  --fixtures-output test/fixtures
```

Use the same command with `--check` in CI to reject generated drift. Runtime
Flutter APIs live in [`eigen_flutter`](https://pub.dev/packages/eigen_flutter).
