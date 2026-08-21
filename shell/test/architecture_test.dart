import 'dart:io';

import 'package:checks/checks.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('the shell consumes only supported eigen_flutter entry points', () {
    final deepImports = <String>[];
    for (final file
        in Directory('lib')
            .listSync(recursive: true)
            .whereType<File>()
            .where((file) => file.path.endsWith('.dart'))) {
      for (final line in file.readAsLinesSync()) {
        if (!line.contains("package:eigen_flutter/")) continue;
        if (line.contains("package:eigen_flutter/shell_support.dart")) {
          continue;
        }
        deepImports.add('${file.path}: $line');
      }
    }

    check(
      because:
          'the published shell must not depend on eigen_flutter file layout',
      deepImports,
    ).isEmpty();
  });

  test(
    'the shell does not depend on provider implementations or eigen_api',
    () {
      final sources = Directory('lib')
          .listSync(recursive: true)
          .whereType<File>()
          .where((file) => file.path.endsWith('.dart'))
          .map((file) => file.readAsStringSync())
          .join('\n');
      final pubspec = File('pubspec.yaml').readAsStringSync();

      check(sources).not((value) => value.contains('package:firebase_'));
      check(sources).not((value) => value.contains('package:eigen_api/'));
      check(pubspec).not((value) => value.contains('eigen_firebase:'));
      check(pubspec).not((value) => value.contains('eigen_api:'));
    },
  );

  test('the shell, not eigen_flutter, owns the root application', () {
    final runner = File('lib/src/app_runner.dart').readAsStringSync();

    check(runner).contains('runApp(');
    check(runner).contains('MaterialApp.router(');
    check(runner).contains('EigenFlutterScope(');
  });
}
