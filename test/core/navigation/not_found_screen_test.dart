import 'package:eigen_flutter/core/navigation/widgets/not_found_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  testWidgets('explains an unknown URL and returns home', (tester) async {
    final router = GoRouter(
      initialLocation: '/missing-page',
      routes: [GoRoute(path: '/home', builder: (_, _) => const Text('HOME'))],
      errorBuilder: (_, state) =>
          NotFoundScreen(location: state.uri.toString()),
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));

    expect(find.text('Page not found'), findsOneWidget);
    expect(find.text('There is no page at /missing-page.'), findsOneWidget);

    await tester.tap(find.text('Go home'));
    await tester.pumpAndSettle();
    expect(find.text('HOME'), findsOneWidget);
  });
}
