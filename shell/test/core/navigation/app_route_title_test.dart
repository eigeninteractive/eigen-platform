import 'package:eigen_shell/core/navigation/widgets/app_route_title.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  test('maps routed URIs to contextual page names', () {
    expect(appPageNameForUri(Uri.parse('/home')), 'Home');
    expect(appPageNameForUri(Uri.parse('/lobby?tab=friends')), 'Lobby');
    expect(appPageNameForUri(Uri.parse('/game/42')), 'Game');
    expect(appPageNameForUri(Uri.parse('/game/42/replay')), 'Replay');
    expect(appPageNameForUri(Uri.parse('/missing')), 'Page not found');
  });

  testWidgets('follows preserved shell branches and root overlays', (
    tester,
  ) async {
    final rootKey = GlobalKey<NavigatorState>();
    final router = GoRouter(
      navigatorKey: rootKey,
      initialLocation: '/home',
      routes: [
        StatefulShellRoute.indexedStack(
          parentNavigatorKey: rootKey,
          builder: (_, _, shell) => shell,
          branches: [
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/home',
                  builder: (_, _) => const Text('Home page'),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: '/lobby',
                  builder: (_, _) => const Text('Lobby page'),
                ),
              ],
            ),
          ],
        ),
        GoRoute(
          path: '/game/:gameId',
          parentNavigatorKey: rootKey,
          builder: (_, _) => const Text('Game page'),
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      MaterialApp.router(
        routerConfig: router,
        builder: (context, child) =>
            AppRouteTitle(router: router, appName: 'Eigen', child: child!),
      ),
    );

    String title() => tester
        .widget<Title>(find.byKey(const ValueKey('app-route-title')))
        .title;

    expect(title(), 'Home · Eigen');

    router.go('/lobby');
    await tester.pumpAndSettle();
    expect(title(), 'Lobby · Eigen');

    router.push('/game/42');
    await tester.pumpAndSettle();
    expect(title(), 'Game · Eigen');

    router.pop();
    await tester.pumpAndSettle();
    expect(title(), 'Lobby · Eigen');

    router.go('/home');
    await tester.pumpAndSettle();
    expect(title(), 'Home · Eigen');
  });
}
