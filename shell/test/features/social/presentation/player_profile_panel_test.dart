import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/features/rating/providers/rating_providers.dart';
import 'package:eigen_shell/features/social/presentation/widgets/player_profile_sheet.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

const _playerId = 'player-1';
const _gameId = 'game-12345678';

const _config = AppConfig(
  branding: Branding(appName: 'Test'),
  engine: EngineConfig(apiBaseUrl: 'https://example.test'),
);

final _game = GameSummary(
  id: _gameId,
  createdBy: null,
  status: GameStatus.finished,
  access: GameAccess.public,
  schemaVersion: 1,
  config: const <String, dynamic>{},
  turnSeconds: null,
  budgetSeconds: null,
  incrementSeconds: null,
  rated: false,
  ratingPool: null,
  minPlayers: 2,
  maxPlayers: 2,
  shortCode: 'ABC123',
  pendingPlayers: null,
  turnDeadline: null,
  outcomes: null,
  finishedAt: 1,
  createdAt: 0,
  updatedAt: 1,
  participants: const [],
);

class _FakePlayerCache extends PlayerInfoCache {
  @override
  Future<Player> build({required String id}) async => Player(
    id: id,
    username: 'tester',
    displayName: 'Test Player',
    avatarUrl: null,
    isAnonymous: false,
  );
}

Future<void> _pump(WidgetTester tester, GoRouter router) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        appConfigProvider.overrideWithValue(_config),
        playerInfoCacheProvider(
          id: _playerId,
        ).overrideWith(_FakePlayerCache.new),
        playerRatingsProvider(_playerId).overrideWith((ref) async => const []),
        playerPublicFinishedGamesProvider(
          playerId: _playerId,
        ).overrideWith((ref) async => [_game]),
      ],
      child: MaterialApp.router(
        theme: AppTheme.light(Colors.teal),
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Widget _replayPage(GoRouterState state) => Scaffold(
  body: Center(child: Text('Replay ${state.pathParameters['gameId']}')),
);

void main() {
  testWidgets('embedded replay preserves the containing profile route', (
    tester,
  ) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => Scaffold(
            body: Center(
              child: FilledButton(
                onPressed: () => context.pushNamed('profile'),
                child: const Text('Open profile'),
              ),
            ),
          ),
        ),
        GoRoute(
          path: '/profile',
          name: 'profile',
          builder: (context, state) => const Scaffold(
            body: Column(
              children: [
                Text('Embedded profile'),
                Expanded(
                  child: PlayerProfilePanel(
                    playerId: _playerId,
                    type: SeatTypeEnum.bot,
                  ),
                ),
              ],
            ),
          ),
        ),
        GoRoute(
          path: '/replay/:gameId',
          name: 'replay',
          builder: (context, state) => _replayPage(state),
        ),
      ],
    );
    addTearDown(router.dispose);
    await _pump(tester, router);

    await tester.tap(find.text('Open profile'));
    await tester.pumpAndSettle();
    final gameRow = find.text('Game #game-123');
    await tester.ensureVisible(gameRow);
    await tester.tap(gameRow);
    await tester.pumpAndSettle();
    expect(find.text('Replay $_gameId'), findsOneWidget);

    router.pop();
    await tester.pumpAndSettle();
    expect(find.text('Embedded profile'), findsOneWidget);
  });

  testWidgets('modal replay dismisses the sheet before navigating', (
    tester,
  ) async {
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => Scaffold(
            body: Center(
              child: FilledButton(
                onPressed: () => showPlayerProfileSheet(
                  context,
                  playerId: _playerId,
                  type: SeatTypeEnum.bot,
                ),
                child: const Text('Open sheet'),
              ),
            ),
          ),
        ),
        GoRoute(
          path: '/replay/:gameId',
          name: 'replay',
          builder: (context, state) => _replayPage(state),
        ),
      ],
    );
    addTearDown(router.dispose);
    await _pump(tester, router);

    await tester.tap(find.text('Open sheet'));
    await tester.pumpAndSettle();
    expect(find.byType(BottomSheet), findsOneWidget);

    final gameRow = find.text('Game #game-123');
    for (var i = 0; i < 3 && gameRow.evaluate().isEmpty; i++) {
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -240));
      await tester.pumpAndSettle();
    }
    expect(gameRow, findsOneWidget);
    await tester.ensureVisible(gameRow);
    await tester.tap(gameRow);
    await tester.pumpAndSettle();

    expect(find.byType(BottomSheet), findsNothing);
    expect(find.text('Replay $_gameId'), findsOneWidget);
  });
}
