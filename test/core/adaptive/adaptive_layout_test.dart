import 'package:eigen_flutter/core/adaptive/adaptive_layout.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('classifies Material window breakpoints at their boundaries', () {
    expect(AppWindowClass.fromWidth(599), AppWindowClass.compact);
    expect(AppWindowClass.fromWidth(600), AppWindowClass.medium);
    expect(AppWindowClass.fromWidth(839), AppWindowClass.medium);
    expect(AppWindowClass.fromWidth(840), AppWindowClass.expanded);
    expect(AppWindowClass.fromWidth(1199), AppWindowClass.expanded);
    expect(AppWindowClass.fromWidth(1200), AppWindowClass.large);
    expect(AppWindowClass.fromWidth(1599), AppWindowClass.large);
    expect(AppWindowClass.fromWidth(1600), AppWindowClass.extraLarge);
  });

  testWidgets('builder responds to its local available width', (tester) async {
    Future<void> pumpAt(double width) => tester.pumpWidget(
      MaterialApp(
        home: Center(
          child: SizedBox(
            width: width,
            child: AdaptiveLayoutBuilder(
              builder: (_, _, windowClass) => Text(windowClass.name),
            ),
          ),
        ),
      ),
    );

    await pumpAt(500);
    expect(find.text('compact'), findsOneWidget);

    await pumpAt(700);
    expect(find.text('medium'), findsOneWidget);
  });

  testWidgets('constrained pane caps readable content width', (tester) async {
    final childKey = GlobalKey();
    await tester.pumpWidget(
      MaterialApp(
        home: SizedBox(
          width: 1200,
          child: ConstrainedContentPane(
            maxWidth: 720,
            child: ColoredBox(key: childKey, color: Colors.blue),
          ),
        ),
      ),
    );

    expect(tester.getSize(find.byKey(childKey)).width, 720);
  });

  test('responsive grid stays single-column until its content threshold', () {
    final compact =
        responsiveCardGridDelegate(
              availableWidth: 700,
              maxCrossAxisExtent: 560,
              mainAxisExtent: 112,
            )
            as SliverGridDelegateWithMaxCrossAxisExtent;
    final expanded =
        responsiveCardGridDelegate(
              availableWidth: 1000,
              maxCrossAxisExtent: 560,
              mainAxisExtent: 112,
            )
            as SliverGridDelegateWithMaxCrossAxisExtent;

    expect(compact.maxCrossAxisExtent, 700);
    expect(expanded.maxCrossAxisExtent, 560);
  });

  group('large text card layout', () {
    test('uses a grid for expanded windows at the default text size', () {
      expect(
        shouldUseCardGrid(
          windowClass: AppWindowClass.expanded,
          textScaler: TextScaler.noScaling,
        ),
        isTrue,
      );
    });

    test('uses an intrinsically sized list when text is enlarged', () {
      expect(
        shouldUseCardGrid(
          windowClass: AppWindowClass.extraLarge,
          textScaler: const TextScaler.linear(1.3),
        ),
        isFalse,
      );
    });

    test('does not use a grid in compact or medium windows', () {
      for (final windowClass in [
        AppWindowClass.compact,
        AppWindowClass.medium,
      ]) {
        expect(
          shouldUseCardGrid(
            windowClass: windowClass,
            textScaler: TextScaler.noScaling,
          ),
          isFalse,
        );
      }
    });
  });
}
