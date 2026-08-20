# Example Game client module

The immutable payload classes and typed rules base under `generated/` come from
the authoritative TypeScript schemas. Regenerate them after changing a schema
or shared fixture:

```sh
dart run eigen_codegen:generate_payloads \
  --contract ../server/game-contract.json \
  --output lib/game/generated/payloads.dart \
  --fixtures-output test/fixtures
flutter test
```

Keep `module.dart` and `v1/rules.dart` handwritten: they contain client-side
legality and preview behavior plus game presentation. The server remains
authoritative. The generated `test/game/twin_fixtures_test.dart` runs the
contract's same fixtures against this Dart rules registry.
