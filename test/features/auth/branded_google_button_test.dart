import 'dart:ui' show PointerDeviceKind;

import 'package:eigen_flutter/features/auth/presentation/widgets/branded_google_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('provides branded interaction and a 48dp target', (tester) async {
    var presses = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(child: BrandedGoogleButton(onPressed: () => presses++)),
        ),
      ),
    );

    final semantics = tester
        .getSemantics(find.byType(BrandedGoogleButton))
        .getSemanticsData();
    expect(semantics.label, 'Sign in with Google');
    expect(semantics.hasAction(SemanticsAction.tap), isTrue);
    expect(
      tester.getSize(find.byType(InkWell)).height,
      greaterThanOrEqualTo(48),
    );

    await tester.tap(find.byType(BrandedGoogleButton));
    expect(presses, 1);
  });

  testWidgets('announces and displays progress while loading', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: BrandedGoogleButton(onPressed: null, isLoading: true),
        ),
      ),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    final semantics = tester
        .getSemantics(find.byType(BrandedGoogleButton))
        .getSemanticsData();
    expect(semantics.label, 'Signing in with Google');
    expect(semantics.hasAction(SemanticsAction.tap), isFalse);
  });

  testWidgets('composites interaction ink above the brand artwork', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(hoverColor: Colors.red),
        home: Scaffold(
          body: Center(child: BrandedGoogleButton(onPressed: () {})),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Ink.image paints the opaque artwork into the Material's ink layer. The
    // same Material therefore composites InkWell hover/pressed ink above it.
    expect(find.byType(Ink), findsOneWidget);
    expect(find.byType(Image), findsNothing);
    final ink = tester.widget<Ink>(find.byType(Ink));
    expect((ink.decoration! as BoxDecoration).image, isNotNull);

    final mouse = await tester.createGesture(kind: PointerDeviceKind.mouse);
    await mouse.addPointer(location: Offset.zero);
    await mouse.moveTo(tester.getCenter(find.byType(BrandedGoogleButton)));
    await tester.pump(const Duration(milliseconds: 200));

    expect(tester.takeException(), isNull);
    await mouse.removePointer();
  });
}
