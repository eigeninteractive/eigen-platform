import 'package:eigen_firebase/eigen_firebase.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('FirebaseAdapterConfig.validate', () {
    test('accepts native configuration without a VAPID key', () {
      const config = FirebaseAdapterConfig(
        googleWebClientId: 'client.apps.googleusercontent.com',
        vapidKey: '',
      );

      expect(() => config.validate(isWeb: false), returnsNormally);
    });

    test('accepts complete web configuration and an auth host', () {
      const config = FirebaseAdapterConfig(
        googleWebClientId: 'client.apps.googleusercontent.com',
        vapidKey: 'public-vapid-key',
        authDomain: 'auth.game.example.com',
      );

      expect(() => config.validate(isWeb: true), returnsNormally);
    });

    test('reports all missing required web declarations', () {
      const config = FirebaseAdapterConfig(
        googleWebClientId: 'REPLACE_ME.apps.googleusercontent.com',
        vapidKey: '',
      );

      expect(
        () => config.validate(isWeb: true),
        throwsA(
          isA<StateError>()
              .having(
                (error) => error.message,
                'message',
                contains('GOOGLE_WEB_CLIENT_ID is required'),
              )
              .having(
                (error) => error.message,
                'message',
                contains('FIREBASE_VAPID_KEY is required for web'),
              ),
        ),
      );
    });

    test('rejects an auth URL rather than a hostname', () {
      const config = FirebaseAdapterConfig(
        googleWebClientId: 'client.apps.googleusercontent.com',
        vapidKey: 'public-vapid-key',
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
