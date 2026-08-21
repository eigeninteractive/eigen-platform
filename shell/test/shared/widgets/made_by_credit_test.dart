import 'dart:ui' show SemanticsAction;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/shared/widgets/made_by_credit.dart';
import 'package:url_launcher/link.dart';

/// The line as the app ships it, and as the game's own website renders it.
AppConfig _config(String credit) => AppConfig(
  branding: Branding(appName: 'Test App', madeByCredit: credit),
  engine: const EngineConfig(apiBaseUrl: 'https://example.test'),
);

Future<void> _pump(WidgetTester tester, String credit) => tester.pumpWidget(
  ProviderScope(
    overrides: [appConfigProvider.overrideWithValue(_config(credit))],
    child: const MaterialApp(home: Scaffold(body: MadeByCredit())),
  ),
);

void main() {
  testWidgets('links the brand inside the line and nothing else', (
    tester,
  ) async {
    await _pump(tester, 'Built with EigenInteractive');

    // "Built with" remains prose; only the name is represented by a link.
    expect(find.text('Built with '), findsOneWidget);
    expect(find.byType(Link), findsOneWidget);
  });

  testWidgets('underlines the link and exposes link semantics and focus', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await _pump(tester, 'Built with EigenInteractive');

    final context = tester.element(find.byType(MadeByCredit));
    final primary = Theme.of(context).colorScheme.primary;
    final brand = tester.widget<Text>(find.text('EigenInteractive'));
    expect(brand.style?.color, primary);
    expect(brand.style?.decoration, TextDecoration.underline);

    final node = tester.getSemantics(find.bySemanticsLabel('EigenInteractive'));
    final data = node.getSemanticsData();
    expect(data.flagsCollection.isLink, isTrue);
    expect(data.hasAction(SemanticsAction.tap), isTrue);
    expect(data.linkUrl, Uri.parse('https://eigeninteractive.com'));

    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
    final focusedContext = tester.binding.focusManager.primaryFocus?.context;
    expect(focusedContext, isNotNull);
    expect(
      focusedContext!.findAncestorWidgetOfExactType<TextButton>(),
      isNotNull,
    );
    semantics.dispose();
  });

  testWidgets('leaves a credit that never names the engine as plain text', (
    tester,
  ) async {
    // Otherwise an app that replaced the line entirely would have its own
    // words silently linked to us.
    await _pump(tester, 'Made by tester');

    expect(find.text('Made by tester'), findsOneWidget);
    expect(find.byType(Link), findsNothing);
  });
}
