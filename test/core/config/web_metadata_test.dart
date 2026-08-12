import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('reference web shell declares its language and install metadata', () {
    final index = File('example/web/index.html').readAsStringSync();
    final manifest =
        jsonDecode(File('example/web/manifest.json').readAsStringSync())
            as Map<String, dynamic>;

    expect(index, contains('<html lang="en">'));
    expect(index, contains('<meta name="theme-color"'));
    expect(index, contains('rel="icon"'));
    expect(manifest['id'], '.');
    expect(manifest['scope'], '.');

    final icons = manifest['icons']! as List<dynamic>;
    expect(icons, isNotEmpty);
    expect(
      icons.where(
        (value) => (value as Map<String, dynamic>)['purpose'] == 'maskable',
      ),
      isNotEmpty,
    );
    for (final value in icons) {
      final icon = value as Map<String, dynamic>;
      expect(icon['src'], isNotEmpty);
      expect(icon['sizes'], isNotEmpty);
      expect(icon['type'], startsWith('image/'));
      expect(File('example/web/${icon['src']}').existsSync(), isTrue);
    }
  });
}
