import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/core/navigation/widgets/shell_scaffold.dart';
import 'package:eigen_shell/features/social/providers/social_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  testWidgets('medium rail scrolls instead of overflowing a short window', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(700, 300));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = GoRouter(
      routes: [
        StatefulShellRoute.indexedStack(
          builder: (_, _, navigationShell) =>
              ShellScaffold(navigationShell: navigationShell),
          branches: [
            _branch('/', 'Home body'),
            _branch('/lobby', 'Lobby body'),
            _branch('/history', 'History body'),
            _branch('/social', 'Social body'),
            _branch('/about', 'About body'),
            _branch('/settings', 'Settings body'),
          ],
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          isOfflineProvider.overrideWithValue(false),
          isAnonymousProvider.overrideWithValue(false),
          soloPlayAvailableProvider.overrideWithValue(false),
          incomingRequestsProvider.overrideWith(
            (_) async => const <FriendRequest>[],
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pump();

    final rail = tester.widget<NavigationRail>(find.byType(NavigationRail));
    expect(rail.extended, isFalse);
    expect(rail.scrollable, isTrue);
    expect(rail.leadingAtTop, isFalse);
    expect(tester.takeException(), isNull);
  });
}

StatefulShellBranch _branch(String path, String label) {
  return StatefulShellBranch(
    routes: [GoRoute(path: path, builder: (_, _) => Text(label))],
  );
}
