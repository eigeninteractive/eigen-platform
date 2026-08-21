import 'dart:io';

import 'package:checks/checks.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Firebase uses only supported eigen_flutter entry points', () {
    final deepImports = <String>[];
    for (final file
        in Directory('lib')
            .listSync(recursive: true)
            .whereType<File>()
            .where((file) => file.path.endsWith('.dart'))) {
      for (final line in file.readAsLinesSync()) {
        if (!line.contains("package:eigen_flutter/")) continue;
        if (line.contains("package:eigen_flutter/eigen_flutter.dart") ||
            line.contains("package:eigen_flutter/adapters.dart")) {
          continue;
        }
        deepImports.add('${file.path}: $line');
      }
    }

    check(
      because:
          'the optional adapter must compose through eigen_flutter public '
          'boundaries, not depend on its feature layout',
      deepImports,
    ).isEmpty();
  });
}
