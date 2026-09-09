import 'package:checks/checks.dart';
import 'package:eigen_firebase/src/notifications/firebase_notification_service.dart';
import 'package:eigen_flutter/adapters.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('resolveNotificationPermissionState', () {
    test('does not offer a prompt when messaging is unavailable', () {
      for (final status in AuthorizationStatus.values) {
        check(
          resolveNotificationPermissionState(
            authorizationStatus: status,
            available: false,
            isAndroid: false,
          ),
        ).equals(NotificationPermissionState.unavailable);
      }
    });

    test('maps authorized and provisional grants to enabled', () {
      for (final status in [
        AuthorizationStatus.authorized,
        AuthorizationStatus.provisional,
      ]) {
        check(
          resolveNotificationPermissionState(
            authorizationStatus: status,
            available: true,
            isAndroid: false,
          ),
        ).equals(NotificationPermissionState.enabled);
      }
    });

    test('maps a reliable not-determined status to promptable', () {
      check(
        resolveNotificationPermissionState(
          authorizationStatus: AuthorizationStatus.notDetermined,
          available: true,
          isAndroid: false,
        ),
      ).equals(NotificationPermissionState.promptable);
    });

    test('treats a non-Android denial as blocked', () {
      check(
        resolveNotificationPermissionState(
          authorizationStatus: AuthorizationStatus.denied,
          available: true,
          isAndroid: false,
        ),
      ).equals(NotificationPermissionState.blocked);
    });

    test('treats a retryable Android denial as promptable', () {
      check(
        resolveNotificationPermissionState(
          authorizationStatus: AuthorizationStatus.denied,
          available: true,
          isAndroid: true,
        ),
      ).equals(NotificationPermissionState.promptable);
    });

    test('treats a permanent denial as blocked', () {
      check(
        resolveNotificationPermissionState(
          authorizationStatus: AuthorizationStatus.deniedPermanently,
          available: true,
          isAndroid: true,
        ),
      ).equals(NotificationPermissionState.blocked);
    });
  });
}
