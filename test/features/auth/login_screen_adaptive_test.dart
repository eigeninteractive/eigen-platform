import 'package:eigen_flutter/core/config/app_config.dart';
import 'package:eigen_flutter/core/theme/app_theme.dart';
import 'package:eigen_flutter/features/auth/presentation/screens/login_screen.dart';
import 'package:eigen_flutter/features/auth/providers/auth_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets(
    'stays scrollable with usable legal links on compact large text',
    (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appConfigProvider.overrideWithValue(
              const AppConfig(
                branding: Branding(
                  appName: 'Rock Paper Scissors',
                  seedColor: Colors.teal,
                ),
                engine: EngineConfig(
                  apiBaseUrl: 'https://example.test',
                  appHost: 'example.test',
                  googleWebClientId: 'test-client',
                  firebaseVapidKey: 'test-vapid-key',
                ),
              ),
            ),
            authControllerProvider.overrideWithValue(
              const AsyncData<void>(null),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.light(Colors.teal),
            home: const LoginScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(SingleChildScrollView), findsOneWidget);
      for (final label in ['Terms of Service', 'Privacy Policy']) {
        final button = find.ancestor(
          of: find.text(label),
          matching: find.byType(TextButton),
        );
        expect(button, findsOneWidget);
        expect(tester.getSize(button).height, greaterThanOrEqualTo(48));
      }
    },
  );
}
