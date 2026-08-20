import 'dart:io';

import 'package:checks/checks.dart';
import 'package:test/test.dart';

void main() {
  test('the client stays pure Dart', () {
    final forbidden = <String>[
      "package:flutter/",
      "package:flutter_riverpod/",
      "package:riverpod/",
      "package:firebase_",
      "package:go_router/",
    ];
    final violations = <String>[];

    for (final file
        in Directory('lib')
            .listSync(recursive: true)
            .whereType<File>()
            .where((file) => file.path.endsWith('.dart'))) {
      final source = file.readAsStringSync();
      for (final dependency in forbidden) {
        if (source.contains(dependency)) {
          violations.add('${file.path}: $dependency');
        }
      }
    }

    check(
      because:
          'eigen_client must compile without Flutter, state management, '
          'Firebase, or navigation',
      violations,
    ).isEmpty();
  });
}
