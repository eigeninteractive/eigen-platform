import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/features/game/presentation/widgets/play_vs_bot_dialog.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/container.dart';
import '../../../helpers/fakes.dart';

/// A module whose game can be played on the device, in an untimed mode.
class _LocalModule extends SampleModule {
  const _LocalModule();

  @override
  Map<int, GameRules> get versions => const {1: LocalSampleRules()};

  @override
  GameCreationSpec get creationSpec => const GameCreationSpec(
    timingConfigs: {
      'Untimed': UntimedConfig(),
      'Rapid': PerActionConfig(maxSeconds: 60),
    },
  );
}

class _SchemaTwoModule extends SampleModule {
  const _SchemaTwoModule();

  @override
  Map<int, GameRules> get versions => const {
    1: SampleRules(),
    2: SampleRules(),
  };

  @override
  GameCreationSpec get creationSpec => const GameCreationSpec(
    timingConfigs: {'Rapid': PerActionConfig(maxSeconds: 60)},
  );
}

class _StubAvailableBots extends AvailableBots {
  _StubAvailableBots(this.bots);

  final List<Bot> bots;

  @override
  Future<List<Bot>> build() async => bots;
}

Bot _bot(String id, int schemaVersion, {BotType type = BotType.engine}) => Bot(
  id: id,
  username: id,
  displayName: '$id bot',
  avatarUrl: null,
  schemaVersion: schemaVersion,
  type: type,
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

  group('offline play', () {
    test(
      'is available when an untimed mode has a bot this build can run',
      () async {
        final container = makeContainer(
          overrides: [
            currentGameModuleProvider.overrideWithValue(const _LocalModule()),
            availableBotsProvider.overrideWith(
              () => _StubAvailableBots([_bot('sample-bot', 1)]),
            ),
          ],
        );
        await container.read(availableBotsProvider.future);

        expect(container.read(localPlayAvailableProvider), isTrue);
        // The solo entry opens for either arm, so this is enough on its own.
        expect(container.read(soloPlayAvailableProvider), isTrue);
      },
    );

    test('is unavailable when no bot has a brain in this build', () async {
      final container = makeContainer(
        overrides: [
          currentGameModuleProvider.overrideWithValue(const _LocalModule()),
          availableBotsProvider.overrideWith(
            // A registry row this build ships no brain for.
            () => _StubAvailableBots([_bot('server-only', 1)]),
          ),
        ],
      );
      await container.read(availableBotsProvider.future);

      expect(container.read(localPlayAvailableProvider), isFalse);
    });

    test('is unavailable when the game ships no local unit', () async {
      final container = makeContainer(
        overrides: [
          currentGameModuleProvider.overrideWithValue(const SampleModule()),
          availableBotsProvider.overrideWith(
            () => _StubAvailableBots([_bot('sample-bot', 1)]),
          ),
        ],
      );
      await container.read(availableBotsProvider.future);

      expect(container.read(localPlayAvailableProvider), isFalse);
    });

    testWidgets('untimed offers only bots this build can run, timed only '
        'bots the server can dispatch', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            currentGameModuleProvider.overrideWithValue(const _LocalModule()),
            availableBotsProvider.overrideWith(
              () => _StubAvailableBots([
                _bot('sample-bot', 1),
                _bot('server-only', 1),
                _bot('device-only', 1, type: BotType.local),
              ]),
            ),
          ],
          child: const MaterialApp(home: Scaffold(body: PlayVsBotDialog())),
        ),
      );
      await tester.pumpAndSettle();

      // The picker opens untimed, because that arm has an opponent: only the
      // bot whose username this build ships a brain for.
      DropdownMenu<String> dropdown() => tester.widget<DropdownMenu<String>>(
        find.byType(DropdownMenu<String>),
      );
      expect(
        dropdown().dropdownMenuEntries.map((entry) => entry.value),
        orderedEquals(['sample-bot']),
      );

      // Switching to a timed mode moves the game to the server, where the
      // device-only bot cannot be dispatched and the others can.
      await tester.tap(find.text('Rapid'));
      await tester.pumpAndSettle();
      expect(
        dropdown().dropdownMenuEntries.map((entry) => entry.value),
        orderedEquals(['sample-bot', 'server-only']),
      );
    });
  });
}
