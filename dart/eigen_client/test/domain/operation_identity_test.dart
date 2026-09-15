import 'package:checks/checks.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

final _uuidV4 = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-'
  r'[0-9a-f]{12}$',
);

void main() {
  for (final (name, mint) in <(String, String Function())>[
    ('newGameCreationId', newGameCreationId),
    ('newCheckoutOperationId', newCheckoutOperationId),
  ]) {
    test('$name creates distinct RFC 4122 version-4 identities', () {
      final values = {for (var index = 0; index < 100; index++) mint()};

      check(values).length.equals(100);
      for (final value in values) {
        expect(value, matches(_uuidV4));
      }
    });
  }
}
