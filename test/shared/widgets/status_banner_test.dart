import 'dart:ui' show SemanticsRole;

import 'package:eigen_flutter/shared/widgets/status_banner.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('exposes system status as one semantic status node', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();

    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: StatusBanner(
            leading: Icon(Icons.cloud_off),
            label: 'Connection lost',
            backgroundColor: Colors.black,
            foregroundColor: Colors.white,
          ),
        ),
      ),
    );

    final node = tester.getSemantics(find.bySemanticsLabel('Connection lost'));
    final data = node.getSemanticsData();
    expect(data.label, 'Connection lost');
    expect(data.role, SemanticsRole.status);
    expect(find.bySemanticsLabel('Connection lost'), findsOneWidget);
    semantics.dispose();
  });
}
