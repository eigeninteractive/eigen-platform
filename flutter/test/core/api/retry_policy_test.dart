import 'package:checks/checks.dart';
import 'package:dio/dio.dart';
import 'package:eigen_flutter/core/api/retry_policy.dart';
import 'package:eigen_flutter/core/errors/engine_exception.dart';
import 'package:flutter_test/flutter_test.dart';

DioException _transport(
  String method,
  DioExceptionType type, {
  Map<String, dynamic> headers = const {},
}) => DioException(
  requestOptions: RequestOptions(
    path: '/api/engine/lobby',
    method: method,
    headers: headers,
  ),
  type: type,
);

/// A mutation as the engine client actually sends one; see `command_id.dart`.
DioException _keyedWrite(String method, DioExceptionType type) => _transport(
  method,
  type,
  headers: {'Idempotency-Key': '0199a4e0-8f7b-7c3a-b2d5-6894a57f9324'},
);

DioException _withResponse(String method, int status) => DioException(
  requestOptions: RequestOptions(path: '/api/engine/lobby', method: method),
  response: Response<dynamic>(
    requestOptions: RequestOptions(path: '/api/engine/lobby', method: method),
    statusCode: status,
  ),
);

void main() {
  group('retryTransient (transport layer)', () {
    const transportFailures = [
      DioExceptionType.connectionTimeout,
      DioExceptionType.sendTimeout,
      DioExceptionType.receiveTimeout,
      DioExceptionType.connectionError,
    ];

    test('retries a GET whose failure carried no response', () {
      for (final type in transportFailures) {
        check(retryTransient(_transport('GET', type), 1)).equals(true);
      }
    });

    test('retries a keyed mutation, which the server replays not reapplies', () {
      // Dio resends the original RequestOptions, so the retry carries the same
      // Idempotency-Key: the engine answers from its committed receipt.
      for (final type in transportFailures) {
        check(retryTransient(_keyedWrite('POST', type), 1)).equals(true);
      }
      for (final method in ['POST', 'PUT', 'DELETE', 'PATCH']) {
        check(
          retryTransient(
            _keyedWrite(method, DioExceptionType.connectionError),
            1,
          ),
        ).equals(true);
      }
    });

    test('matches the key header case-insensitively', () {
      // HTTP header names are case-insensitive and Dio preserves whatever the
      // caller wrote, so the check must not depend on one spelling.
      for (final name in ['idempotency-key', 'IDEMPOTENCY-KEY']) {
        check(
          retryTransient(
            _transport(
              'POST',
              DioExceptionType.connectionError,
              headers: {name: 'k'},
            ),
            1,
          ),
        ).equals(true);
      }
    });

    test('never retries an unkeyed write, even on a transport failure', () {
      // Without a key the outcome of a timed-out POST is genuinely unknown, and
      // resending it could apply the same intent twice.
      for (final method in ['POST', 'PUT', 'DELETE', 'PATCH']) {
        check(
          retryTransient(
            _transport(method, DioExceptionType.connectionError),
            1,
          ),
        ).equals(false);
      }
    });

    test('never retries a failure that carried a response', () {
      // The server answered: a decision, not a blip, even for a 5xx or a 429.
      check(retryTransient(_withResponse('GET', 500), 1)).equals(false);
      check(retryTransient(_withResponse('GET', 429), 1)).equals(false);
      check(retryTransient(_withResponse('GET', 404), 1)).equals(false);
    });

    test('does not retry non-transport error types', () {
      check(
        retryTransient(_transport('GET', DioExceptionType.cancel), 1),
      ).equals(false);
      check(
        retryTransient(_transport('GET', DioExceptionType.badResponse), 1),
      ).equals(false);
      check(
        retryTransient(_keyedWrite('POST', DioExceptionType.cancel), 1),
      ).equals(false);
    });
  });

  group('engineProviderRetry (provider layer)', () {
    test('retries a transport failure with short exponential backoff', () {
      final err = _transport('GET', DioExceptionType.connectionError);
      check(
        engineProviderRetry(0, err),
      ).equals(const Duration(milliseconds: 200));
      check(
        engineProviderRetry(1, err),
      ).equals(const Duration(milliseconds: 400));
    });

    test('stops after two tries', () {
      final err = _transport('GET', DioExceptionType.connectionError);
      check(engineProviderRetry(2, err)).isNull();
      check(engineProviderRetry(5, err)).isNull();
    });

    test('never retries a server-reported failure', () {
      // The whole point: Riverpod's default would re-run these up to ten times.
      check(
        engineProviderRetry(0, const EngineException('nope', code: null)),
      ).isNull();
      check(engineProviderRetry(0, _withResponse('GET', 409))).isNull();
      check(engineProviderRetry(0, Exception('unexpected'))).isNull();
    });
  });
}
