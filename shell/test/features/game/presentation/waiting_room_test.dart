import 'dart:async';

import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_shell/features/game/presentation/screens/game_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../../helpers/fakes.dart';

/// The regression these cover: a creator sitting in the waiting room while the
/// second player joins used to never see Start, because the screen read its
/// status from a one-shot HTTP summary that nothing re-issued. Both assertions
/// here are that the screen follows the SESSION, so neither may touch a summary.

const _gameId = '11111111-2222-3333-4444-555555555555';
const _creator = 'user-a';
const _joiner = 'user-b';

Session _session({
  required int seq,
  required String status,
  required int seats,
}) => Session.fromJson({
  'type': 'session',
  'seq': seq,
  'gameId': _gameId,
  'shortCode': 'ABC123',
  'access': 'private',
  'schemaVersion': 1,
  'config': <String, dynamic>{},
  'turnSeconds': null,
  'budgetSeconds': null,
  'incrementSeconds': null,
  'rated': false,
  'ratingPool': null,
  'minPlayers': 2,
  'maxPlayers': 2,
  'createdBy': _creator,
  'status': status,
  'players': [
    for (var i = 0; i < seats; i++)
      {
        'playerIndex': i,
        'userId': i == 0 ? _creator : _joiner,
        'botId': null,
        'type': 'human',
      },
  ],
  'version': null,
  'frame': null,
});

Player _player(String id) => Player(
  id: id,
  username: id,
  displayName: id,
  avatarUrl: null,
  isAnonymous: false,
);

/// Serves one identity without a network or a persisted cache. The seat
/// identities have to resolve for the roster to render, and what is under test
/// is the status wiring, not identity.
class _FakePlayerCache extends PlayerInfoCache {
  @override
  Future<Player> build({required String id}) async => _player(id);
}

Future<void> _pump(
  WidgetTester tester,
  Stream<GameSession> sessions, {
  required String viewer,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        currentGameModuleProvider.overrideWithValue(const SampleModule()),
        appConfigProvider.overrideWithValue(
          const AppConfig(
            branding: Branding(appName: 'Test'),
            engine: EngineConfig(apiBaseUrl: 'https://example.test'),
          ),
        ),
        currentUserProvider.overrideWithValue(
          AuthUser(id: viewer, isAnonymous: false),
        ),
        currentUserIdProvider.overrideWithValue(viewer),
        gameSessionProvider(gameId: _gameId).overrideWith((ref) => sessions),
        playerInfoCacheProvider(
          id: _creator,
        ).overrideWith(_FakePlayerCache.new),
        playerInfoCacheProvider(id: _joiner).overrideWith(_FakePlayerCache.new),
      ],
      child: const MaterialApp(home: GameScreen(gameId: _gameId)),
    ),
  );
  // Not pumpAndSettle: with no session yet the screen shows a progress
  // indicator, which animates forever and never settles. The caller has already
  // queued the first snapshot, so a couple of frames deliver it and resolve the
  // seat identities behind it.
  await _flush(tester);
}

/// Let the stream deliver and the identity futures resolve, then settle.
Future<void> _flush(WidgetTester tester) async {
  await tester.pump();
  await tester.pump();
  await tester.pumpAndSettle();
}

GameSession _waiting({
  required int seq,
  required String status,
  required int seats,
}) => GameSession(
  snapshot: _session(seq: seq, status: status, seats: seats),
  frame: null,
);

void main() {
  testWidgets('offers Start to the creator the moment the roster fills', (
    tester,
  ) async {
    final sessions = StreamController<GameSession>();
    addTearDown(sessions.close);

    // Seated alone: waiting, and there is nothing to start.
    sessions.add(_waiting(seq: 1, status: 'waiting', seats: 1));
    await _pump(tester, sessions.stream, viewer: _creator);
    expect(find.text('Waiting for players...'), findsOne);
    expect(find.text('Start Game'), findsNothing);

    // The joiner takes the second seat. No refetch, no navigation, no pull:
    // the snapshot says ready and the button is there.
    sessions.add(_waiting(seq: 2, status: 'ready', seats: 2));
    await _flush(tester);
    expect(find.text('All players ready!'), findsOne);
    expect(find.text('Start Game'), findsOne);
  });

  testWidgets('never offers Start to a player who is not the creator', (
    tester,
  ) async {
    final sessions = StreamController<GameSession>();
    addTearDown(sessions.close);

    sessions.add(_waiting(seq: 2, status: 'ready', seats: 2));
    await _pump(tester, sessions.stream, viewer: _joiner);
    expect(find.text('All players ready!'), findsOne);
    expect(find.text('Start Game'), findsNothing);
    expect(find.text('Leave Game'), findsOne);
  });
}
