/// Runs the shared twin fixtures against the Dart RPS twin.
///
/// The files under `test/fixtures/v1/` are written by
/// `eigen_codegen:generate_payloads` from the contract, and are copies of
/// `eigen-server/examples/rps/src/module/fixtures/v1/`, and the server runs the
/// same files against the authoritative TypeScript unit via `@eigen/testkit`.
/// One recorded behaviour, two languages, two CIs: when the twins disagree,
/// one of them goes red.
///
/// Copy this file into your own game; only the module and the fixture path
/// change.
library;

import 'package:eigen_flutter/testing/twin_fixtures.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rps_example/rps.dart';

void main() {
  const module = RpsModule();
  final suites = loadTwinFixtureSuites('test/fixtures');

  test('the fixture suite is present', () {
    expect(
      suites,
      isNotEmpty,
      reason: 'run this from the example package root',
    );
  });

  for (final suite in suites) {
    final rules = module.versions[suite.schemaVersion];
    group('twin fixtures v${suite.schemaVersion} (${suite.path})', () {
      for (final fixtureCase in suite.cases) {
        test(fixtureCase.name, () {
          expect(
            rules,
            isNotNull,
            reason: 'no Dart rules unit for v${suite.schemaVersion}',
          );
          expect(runTwinFixtureCase(rules!, fixtureCase), isEmpty);
        });
      }
    });
  }
}
