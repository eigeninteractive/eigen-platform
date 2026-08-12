import 'package:eigen_flutter/core/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('EngineConfig.validate', () {
    test('accepts native configuration without a VAPID key or app host', () {
      const config = EngineConfig(
        apiBaseUrl: 'http://localhost:8787',
        googleWebClientId: 'client.apps.googleusercontent.com',
        firebaseVapidKey: '',
      );

      expect(() => config.validate(isWeb: false), returnsNormally);
    });

    test('accepts complete web configuration', () {
      const config = EngineConfig(
        apiBaseUrl: 'https://game.example.com',
        googleWebClientId: 'client.apps.googleusercontent.com',
        firebaseVapidKey: 'public-vapid-key',
        appHost: 'game.example.com',
      );

      expect(() => config.validate(isWeb: true), returnsNormally);
    });

    test('reports all missing required web declarations', () {
      const config = EngineConfig(
        apiBaseUrl: '',
        googleWebClientId: 'REPLACE_ME.apps.googleusercontent.com',
        firebaseVapidKey: '',
      );

      expect(
        () => config.validate(isWeb: true),
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
                contains('GOOGLE_WEB_CLIENT_ID is required'),
              )
              .having(
                (error) => error.message,
                'message',
                contains('FIREBASE_VAPID_KEY is required for web'),
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
        googleWebClientId: 'client.apps.googleusercontent.com',
        firebaseVapidKey: '',
        appHost: 'https://game.example.com',
      );

      expect(
        () => config.validate(isWeb: false),
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

    test('treats a custom auth domain as optional', () {
      // Every game ships without one: sign-in works on the Firebase project's
      // own domain, and this only changes the hostname a web player reads on
      // Google's account chooser.
      const config = EngineConfig(
        apiBaseUrl: 'https://game.example.com',
        googleWebClientId: 'client.apps.googleusercontent.com',
        firebaseVapidKey: 'public-vapid-key',
      );

      expect(() => config.validate(isWeb: true), returnsNormally);
    });

    test('rejects an auth domain given as a URL rather than a host', () {
      // Firebase builds `https://<authDomain>/__/auth/handler` from this, so a
      // value carrying its own scheme yields a popup URL that goes nowhere.
      // Failing at startup beats a sign-in that silently never returns.
      const config = EngineConfig(
        apiBaseUrl: 'https://game.example.com',
        googleWebClientId: 'client.apps.googleusercontent.com',
        firebaseVapidKey: 'public-vapid-key',
        authDomain: 'https://auth.game.example.com/',
      );

      expect(
        () => config.validate(isWeb: true),
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            contains('AUTH_DOMAIN must be a hostname'),
          ),
        ),
      );
    });
  });
}
