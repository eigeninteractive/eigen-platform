import 'package:eigen_api/eigen_api.dart';
import 'package:eigen_flutter/core/game/game_creation_spec.dart';
import 'package:eigen_flutter/core/game/game_module.dart';
import 'package:eigen_flutter/features/game/presentation/widgets/play_vs_bot_dialog.dart';
import 'package:eigen_flutter/features/game/providers/game_providers.dart';
import 'package:eigen_flutter/features/game/utils/bot_compatibility.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/container.dart';
import '../../../helpers/fakes.dart';

class _SchemaTwoModule extends SampleModule {
  const _SchemaTwoModule();

  @override
  Map<int, GameRules> get versions => const {2: SampleRules()};

  @override
  GameCreationSpec get creationSpec => const GameCreationSpec(
    minPlayers: 2,
    maxPlayers: 2,
    timingConfigs: {'Rapid': PerActionConfig(maxSeconds: 60)},
  );
}

class _StubAvailableBots extends AvailableBots {
  _StubAvailableBots(this.bots);

  final List<Bot> bots;

  @override
  Future<List<Bot>> build() async => bots;
}

Bot _bot(String id, int schemaVersion) => Bot(
  id: id,
  username: id,
  displayName: '$id bot',
  avatarUrl: null,
  schemaVersion: schemaVersion,
  ratedEligible: true,
  config: const <String, dynamic>{},
);

void main() {
  test('bot schema version is an inclusive capability ceiling', () {
    final bot = _bot('candidate', 2);

    expect(bot.supportsGameSchema(1), isTrue);
    expect(bot.supportsGameSchema(2), isTrue);
    expect(bot.supportsGameSchema(3), isFalse);
  });

  group('soloPlayAvailableProvider', () {
    for (final testCase in [
      (name: 'rejects an older bot', schemaVersion: 1, expected: false),
      (
        name: 'accepts an equal-capability bot',
        schemaVersion: 2,
        expected: true,
      ),
      (
        name: 'accepts a newer-capability bot',
        schemaVersion: 3,
        expected: true,
      ),
    ]) {
      test(testCase.name, () async {
        final container = makeContainer(
          overrides: [
            currentGameModuleProvider.overrideWithValue(
              const _SchemaTwoModule(),
            ),
            availableBotsProvider.overrideWith(
              () => _StubAvailableBots([
                _bot('candidate', testCase.schemaVersion),
              ]),
            ),
          ],
        );

        await container.read(availableBotsProvider.future);

        expect(container.read(soloPlayAvailableProvider), testCase.expected);
      });
    }
  });

  testWidgets('dialog offers only bots whose capability covers the game', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          currentGameModuleProvider.overrideWithValue(const _SchemaTwoModule()),
          availableBotsProvider.overrideWith(
            () => _StubAvailableBots([
              _bot('older', 1),
              _bot('equal', 2),
              _bot('newer', 3),
            ]),
          ),
        ],
        child: const MaterialApp(home: Scaffold(body: PlayVsBotDialog())),
      ),
    );
    await tester.pumpAndSettle();

    final dropdown = tester.widget<DropdownMenu<String>>(
      find.byType(DropdownMenu<String>),
    );
    expect(
      dropdown.dropdownMenuEntries.map((entry) => entry.value),
      orderedEquals(['equal', 'newer']),
    );
  });
}
