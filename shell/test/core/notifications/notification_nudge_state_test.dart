import 'package:checks/checks.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('resolveNotificationNudgeState', () {
    test('hides when notifications are enabled or unavailable', () {
      for (final state in [
        NotificationPermissionState.enabled,
        NotificationPermissionState.unavailable,
      ]) {
        check(
          resolveNotificationNudgeState(permissionState: state),
        ).equals(NotificationNudgeState.hidden);
      }
    });

    test('shows the inline enable action while permission is promptable', () {
      check(
        resolveNotificationNudgeState(
          permissionState: NotificationPermissionState.promptable,
        ),
      ).equals(NotificationNudgeState.enable);
    });

    test('offers settings recovery after permission is blocked', () {
      check(
        resolveNotificationNudgeState(
          permissionState: NotificationPermissionState.blocked,
        ),
      ).equals(NotificationNudgeState.openSettings);
    });
  });
}
