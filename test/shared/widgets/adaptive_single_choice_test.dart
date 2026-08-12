import 'package:eigen_flutter/shared/widgets/adaptive_single_choice.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const choices = [
    AdaptiveChoice(value: 'one', label: 'One'),
    AdaptiveChoice(value: 'two', label: 'Two'),
    AdaptiveChoice(value: 'three', label: 'Three'),
  ];

  Future<void> pumpChoice(
    WidgetTester tester, {
    required double width,
    required ValueChanged<String> onChanged,
  }) {
    return tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: width,
              child: AdaptiveSingleChoice<String>(
                choices: choices,
                value: 'one',
                onChanged: onChanged,
              ),
            ),
          ),
        ),
      ),
    );
  }

  testWidgets('shows visible segments when the options fit', (tester) async {
    String? selected;
    await pumpChoice(
      tester,
      width: 360,
      onChanged: (value) => selected = value,
    );

    expect(find.byType(SegmentedButton<String>), findsOneWidget);
    expect(find.byType(DropdownMenu<String>), findsNothing);

    await tester.tap(find.text('Two'));
    await tester.pump();
    expect(selected, 'two');
  });

  testWidgets('uses a Material 3 menu before segments overflow', (
    tester,
  ) async {
    await pumpChoice(tester, width: 180, onChanged: (_) {});

    expect(find.byType(SegmentedButton<String>), findsNothing);
    expect(find.byType(DropdownMenu<String>), findsOneWidget);
  });

  testWidgets('can be hosted in a standard Material dialog', (tester) async {
    tester.view.physicalSize = const Size(320, 480);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => FilledButton(
              onPressed: () => showDialog<void>(
                context: context,
                builder: (_) => AlertDialog(
                  title: const Text('Choose'),
                  content: SizedBox(
                    width: 480,
                    child: SingleChildScrollView(
                      child: AdaptiveSingleChoice<String>(
                        choices: choices,
                        value: 'one',
                        onChanged: (_) {},
                      ),
                    ),
                  ),
                ),
              ),
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('Choose'), findsOneWidget);
    expect(
      tester.getRect(find.byType(AlertDialog)).right,
      lessThanOrEqualTo(320),
    );
  });
}
