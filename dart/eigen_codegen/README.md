# eigen_codegen

Development-only code generation for EigenInteractive game contracts.

Add `eigen_codegen` as a development dependency, then generate the immutable
Dart payload types and the two version-specific bases used by your game: a
`<Game>V<N>RulesBase` carrying the wire payload codecs, and a
`<Game>V<N>LocalRulesBase` carrying the state codec offline play additionally
needs:

```sh
dart run eigen_codegen:generate_payloads \
  --contract ../server/game-contract.json \
  --output lib/game/generated/payloads.dart \
  --fixtures-output test/fixtures
```

Use the same command with `--check` in CI to reject generated drift. Runtime
Flutter APIs live in [`eigen_flutter`](https://pub.dev/packages/eigen_flutter).
