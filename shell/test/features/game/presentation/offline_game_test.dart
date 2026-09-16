import 'dart:async';

import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/features/game/presentation/screens/game_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';
import '../../../helpers/replica.dart';

/// What being offline means on a game screen (decision 0013): a game played on
/// the server is the replica's copy, shown and not played; a game played on
/// this device is unaffected, because nothing about it needs a network.

const _gameId = '11111111-2222-3333-4444-555555555555';
const _me = 'user-a';
const _offlineLabel = 'Offline · showing this game as it was last seen';

Session _session({required String origin}) => Session.fromJson({
  'type': 'session',
  'seq': 3,
  'gameId': _gameId,
  'shortCode': origin == 'local' ? '' : 'ABC123',
  'access': origin == 'local' ? 'private' : 'public',
  'origin': origin,
  'schemaVersion': 1,
  'config': <String, dynamic>{},
  'turnSeconds': null,
  'budgetSeconds': null,
  'incrementSeconds': null,
  'rated': false,
  'ratingPool': null,
  'minPlayers': 2,
  'maxPlayers': 2,
  'createdBy': _me,
  'status': 'active',
  'players': <Map<String, dynamic>>[
    {'playerIndex': 0, 'userId': _me, 'botId': null, 'type': 'human'},
    {'playerIndex': 1, 'userId': null, 'botId': 'bot-1', 'type': 'bot'},
  ],
  'version': 2,
  'frame': {
    'type': 'frame',
    'version': 2,
    'data': <String, dynamic>{},
    'pendingPlayers': <int>[0],
    'deadline': null,
    'playerTimes': null,
  },
});

Future<void> _pump(
  WidgetTester tester, {
  required bool decidedHere,
  required bool offline,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ...withoutReplica(),
        currentGameModuleProvider.overrideWithValue(const SampleModule()),
        appConfigProvider.overrideWithValue(
          const AppConfig(
            branding: Branding(appName: 'Test'),
            engine: EngineConfig(apiBaseUrl: 'https://example.test'),
          ),
        ),
        currentUserProvider.overrideWithValue(
          const AuthUser(id: _me, isAnonymous: false),
        ),
        currentUserIdProvider.overrideWithValue(_me),
        isOfflineProvider.overrideWithValue(offline),
        // The bot seat's name is not what these assert.
        availableBotsProvider.overrideWith((ref) => Stream.value(const [])),
        isLocalGameProvider(gameId: _gameId)
            .overrideWith((ref) async => decidedHere),
        gameSessionProvider(gameId: _gameId).overrideWith(
          (ref) => Stream.value(
            GameSession(
              snapshot: _session(origin: decidedHere ? 'local' : 'online'),
              frame: null,
            ),
          ),
        ),
      ],
      child: const MaterialApp(home: GameScreen(gameId: _gameId)),
    ),
  );
  await tester.pump();
  await tester.pump();
}

void main() {
  testWidgets('a server game offline says the board is where it was left', (
    tester,
  ) async {
    await _pump(tester, decidedHere: false, offline: true);

    expect(find.text(_offlineLabel), findsOneWidget);
  });

  testWidgets('a server game online shows no such banner', (tester) async {
    await _pump(tester, decidedHere: false, offline: false);

    expect(find.text(_offlineLabel), findsNothing);
  });

  testWidgets('a game this device decides is not waiting for a network', (
    tester,
  ) async {
    await _pump(tester, decidedHere: true, offline: true);

    // Neither banner: it is not offline in any sense that matters here, and
    // there is nothing to reconnect to.
    expect(find.text(_offlineLabel), findsNothing);
    expect(find.text('Reconnecting…'), findsNothing);
  });
}
