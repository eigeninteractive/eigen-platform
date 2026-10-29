import 'dart:async';

import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

void main() {
  for (final status in [400, 401, 403, 404, 429, 500]) {
    test('ticket HTTP $status surfaces and stops reconnecting', () async {
      var attempts = 0;
      final socket = GameSocket(
        baseUrl: 'https://game.example',
        ticketProvider: (_) async {
          attempts++;
          throw EngineException('Ticket refused', statusCode: status);
        },
        initialBackoff: Duration.zero,
      );
      final failures = <GameConnectionException>[];
      final done = Completer<void>();
      socket
          .connect('g')
          .listen(
            (_) => fail('No session expected'),
            onError: (Object error) =>
                failures.add(error as GameConnectionException),
            onDone: done.complete,
          );
      await done.future;
      expect(attempts, 1);
      expect(failures.single.retrying, isFalse);
      expect((failures.single.cause as EngineException).statusCode, status);
    });
  }

  test(
    'transient ticket failure retries, then a permanent refusal stops',
    () async {
      var attempts = 0;
      final socket = GameSocket(
        baseUrl: 'https://game.example',
        ticketProvider: (_) async {
          attempts++;
          throw EngineException(
            'Unavailable',
            statusCode: attempts == 1 ? 503 : 500,
          );
        },
        initialBackoff: Duration.zero,
      );
      final failures = <GameConnectionException>[];
      final done = Completer<void>();
      socket
          .connect('g')
          .listen(
            (_) => fail('No session expected'),
            onError: (Object error) =>
                failures.add(error as GameConnectionException),
            onDone: done.complete,
          );
      await done.future;
      expect(attempts, 2);
      expect(failures.map((e) => e.retrying), [true, false]);
    },
  );

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
