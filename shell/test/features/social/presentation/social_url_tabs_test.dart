import 'package:eigen_client/eigen_client.dart' show Friend, Player;
import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/features/rating/providers/rating_providers.dart';
import 'package:eigen_shell/features/social/providers/social_providers.dart';
import 'package:eigen_shell/features/social/presentation/social_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

class _EmptyFriends extends Friends {
  _EmptyFriends(this.values);

  final List<Friend> values;

  @override
  Future<List<Friend>> build() async => values;
}

class _AdaPlayer extends PlayerInfoCache {
  @override
  Future<Player> build({required String id}) async => Player(
    id: id,
    username: 'ada',
    displayName: 'Ada',
    avatarUrl: null,
    isAnonymous: false,
  );
}

void main() {
  const config = AppConfig(
    branding: Branding(appName: 'Test', seedColor: Colors.teal),
    engine: EngineConfig(apiBaseUrl: 'https://example.test'),
  );
  late GoRouter router;

  Future<void> pumpSocial(
    WidgetTester tester, {
    String initialLocation = '/social',
    List<Friend> friends = const [],
  }) async {
    router = GoRouter(
      initialLocation: initialLocation,
      routes: [
        GoRoute(
          path: '/social',
          builder: (context, state) => const Scaffold(body: SocialScreen()),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appConfigProvider.overrideWithValue(config),
          friendsProvider.overrideWith(() => _EmptyFriends(friends)),
          incomingRequestsProvider.overrideWith((ref) async => const []),
          playerInfoCacheProvider(id: 'ada-id').overrideWith(_AdaPlayer.new),
          playerRatingsProvider('ada-id').overrideWith((ref) async => const []),
          playerPublicFinishedGamesProvider(
            playerId: 'ada-id',
          ).overrideWith((ref) async => const []),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  int selectedTab(WidgetTester tester) =>
      tester.widget<TabBar>(find.byType(TabBar)).controller!.index;

  testWidgets('reads the initial tab from the URL and follows URL changes', (
    tester,
  ) async {
    await pumpSocial(tester, initialLocation: '/social?tab=requests');
    expect(selectedTab(tester), 1);

    router.go('/social?tab=add');
    await tester.pumpAndSettle();
    expect(selectedTab(tester), 2);

    router.go('/social');
    await tester.pumpAndSettle();
    expect(selectedTab(tester), 0);
  });

  testWidgets('writes clicks and swipes to canonical tab URLs', (tester) async {
    final routeUpdates = <MethodCall>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.navigation,
      (call) async {
        if (call.method == 'routeInformationUpdated') routeUpdates.add(call);
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.navigation,
        null,
      ),
    );

    await pumpSocial(tester);
    routeUpdates.clear();

    await tester.tap(find.widgetWithText(Tab, 'Add Friend'));
    await tester.pumpAndSettle();
    expect(
      router.routeInformationProvider.value.uri.toString(),
      '/social?tab=add',
    );
    expect(selectedTab(tester), 2);
    expect(routeUpdates.last.arguments, containsPair('replace', false));

    router.go('/social');
    await tester.pumpAndSettle();
    routeUpdates.clear();
    await tester.drag(find.byType(TabBarView), const Offset(-500, 0));
    await tester.pumpAndSettle();

    expect(selectedTab(tester), 1);
    expect(
      router.routeInformationProvider.value.uri.toString(),
      '/social?tab=requests',
    );
    expect(routeUpdates.last.arguments, containsPair('replace', true));
  });

  testWidgets('marks the selected player in the expanded master list', (
    tester,
  ) async {
    tester.view
      ..physicalSize = const Size(1200, 800)
      ..devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await pumpSocial(
      tester,
      friends: [
        Friend(
          username: 'ada',
          displayName: 'Ada',
          avatarUrl: null,
          isAnonymous: false,
          userId: 'ada-id',
          since: 1,
        ),
      ],
    );

    final ada = find.widgetWithText(ListTile, 'Ada');
    expect(tester.widget<ListTile>(ada).selected, isFalse);

    await tester.tap(ada);
    await tester.pump();
    expect(tester.widget<ListTile>(ada).selected, isTrue);
  });
}
