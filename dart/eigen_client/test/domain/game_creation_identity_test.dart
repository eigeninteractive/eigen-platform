import 'package:checks/checks.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

void main() {
  test('creates distinct RFC 4122 version-4 operation identities', () {
    final values = {
      for (var index = 0; index < 100; index++) newGameCreationId(),
    };

    check(values).length.equals(100);
    for (final value in values) {
      expect(
        value,
        matches(
          RegExp(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-'
            r'[0-9a-f]{12}$',
          ),
        ),
      );
    }
  });
}
