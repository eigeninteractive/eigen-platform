import 'package:eigen_flutter/core/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('EngineConfig.validate', () {
    test('accepts an origin and optional app host', () {
      const config = EngineConfig(
        apiBaseUrl: 'https://game.example.com',
        appHost: 'game.example.com',
      );

      expect(config.validate, returnsNormally);
    });

    test('reports a missing API origin', () {
      const config = EngineConfig(apiBaseUrl: '');

      expect(
        config.validate,
        throwsA(
          isA<StateError>()
              .having(
                (error) => error.message,
                'message',
                contains('API_BASE_URL is required'),
              )
              .having(
                (error) => error.message,
                'message',
                contains('--dart-define-from-file=app-config.json'),
              ),
        ),
      );
    });

    test('rejects an API URL with a path and an app URL instead of a host', () {
      const config = EngineConfig(
        apiBaseUrl: 'https://game.example.com/api',
        appHost: 'https://game.example.com',
      );

      expect(
        config.validate,
        throwsA(
          isA<StateError>()
              .having(
                (error) => error.message,
                'message',
                contains('API_BASE_URL must be an HTTP(S) origin'),
              )
              .having(
                (error) => error.message,
                'message',
                contains('APP_HOST must be a hostname'),
              ),
        ),
      );
    });
  });
}
