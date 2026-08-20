import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

void main() {
  group('buildGameSocketUri', () {
    test('uses wss and the ticket query for an HTTPS Worker origin', () {
      final uri = buildGameSocketUri(
        apiBaseUrl: 'https://game.example',
        gameId: 'game 1',
        ticket: 'header.payload+/=',
      );

      expect(uri.scheme, 'wss');
      expect(uri.host, 'game.example');
      expect(uri.path, '/api/engine/games/game%201/socket');
      expect(uri.queryParameters, {'ticket': 'header.payload+/='});
    });

    test('uses ws for a local HTTP Worker', () {
      final uri = buildGameSocketUri(
        apiBaseUrl: 'http://localhost:8787',
        gameId: 'g1',
        ticket: 'ticket',
      );

      expect(
        uri.toString(),
        'ws://localhost:8787/api/engine/games/g1/socket?ticket=ticket',
      );
    });

    test('rejects a non-HTTP API base URL', () {
      expect(
        () => buildGameSocketUri(
          apiBaseUrl: 'ftp://game.example',
          gameId: 'g1',
          ticket: 'ticket',
        ),
        throwsArgumentError,
      );
    });
  });
}
