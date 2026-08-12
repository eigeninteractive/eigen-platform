import 'dart:ui' show PointerDeviceKind, SemanticsAction, Tristate;

import 'package:eigen_flutter/core/config/app_config.dart';
import 'package:eigen_flutter/shared/widgets/player_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

const _config = AppConfig(
  branding: Branding(appName: 'Test App'),
  engine: EngineConfig(
    apiBaseUrl: 'https://example.test',
    googleWebClientId: 'client',
    firebaseVapidKey: 'vapid',
  ),
);

Future<void> _pump(WidgetTester tester, Widget child, {ThemeData? theme}) =>
    tester.pumpWidget(
      ProviderScope(
        overrides: [appConfigProvider.overrideWithValue(_config)],
        child: MaterialApp(
          theme: theme,
          home: Scaffold(body: Center(child: child)),
        ),
      ),
    );

void main() {
  testWidgets('interactive avatar is labelled, keyboard operable, and 48px', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    var taps = 0;

    await _pump(
      tester,
      PlayerAvatar(
        avatarUrl: null,
        semanticLabel: "Open Ada's profile",
        onTap: () => taps++,
      ),
    );

    expect(find.byTooltip("Open Ada's profile"), findsOneWidget);
    final node = tester.getSemantics(
      find.bySemanticsLabel("Open Ada's profile"),
    );
    final data = node.getSemanticsData();
    expect(data.flagsCollection.isButton, isTrue);
    expect(data.hasAction(SemanticsAction.tap), isTrue);

    final hitTarget = tester.getSize(find.byType(InkResponse));
    expect(hitTarget.width, greaterThanOrEqualTo(48));
    expect(hitTarget.height, greaterThanOrEqualTo(48));
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));

    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
    expect(
      tester
          .getSemantics(find.bySemanticsLabel("Open Ada's profile"))
          .getSemanticsData()
          .flagsCollection
          .isFocused,
      Tristate.isTrue,
    );
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pump();
    expect(taps, 1);
    semantics.dispose();
  });

  testWidgets('non-interactive avatar can be exposed as an image', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();

    await _pump(
      tester,
      const PlayerAvatar(avatarUrl: null, semanticLabel: "Ada's avatar"),
    );

    final data = tester
        .getSemantics(find.bySemanticsLabel("Ada's avatar"))
        .getSemanticsData();
    expect(data.flagsCollection.isImage, isTrue);
    expect(data.hasAction(SemanticsAction.tap), isFalse);
    semantics.dispose();
  });

  testWidgets('composites interaction ink above the opaque avatar', (
    tester,
  ) async {
    await _pump(
      tester,
      PlayerAvatar(avatarUrl: null, onTap: () {}),
      theme: ThemeData(hoverColor: Colors.red),
    );

    // The opaque avatar is the first Stack child. A separate transparent
    // Material and InkResponse are painted after it, so hover/pressed ink cannot
    // be hidden by the CircleAvatar or a network image.
    final stack = tester.widget<Stack>(
      find.descendant(
        of: find.byType(PlayerAvatar),
        matching: find.byType(Stack),
      ),
    );
    expect(stack.children.first, isA<ExcludeSemantics>());
    expect(stack.children.last, isA<Positioned>());
    final overlay = find.descendant(
      of: find.byWidget(stack.children.last),
      matching: find.byType(Material),
    );
    final material = tester.widget<Material>(overlay);
    expect(material.type, MaterialType.transparency);
    expect(material.shape, isA<CircleBorder>());
    expect(
      find.descendant(of: overlay, matching: find.byType(InkResponse)),
      findsOneWidget,
    );

    final mouse = await tester.createGesture(kind: PointerDeviceKind.mouse);
    await mouse.addPointer(location: Offset.zero);
    await mouse.moveTo(tester.getCenter(find.byType(PlayerAvatar)));
    await tester.pump(const Duration(milliseconds: 200));

    expect(tester.takeException(), isNull);
    await mouse.removePointer();
  });
}
