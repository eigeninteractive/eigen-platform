import 'package:checks/checks.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/features/auth/providers/auth_controller.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/container.dart';
import '../../helpers/replica.dart';

final class _FakeAuthGateway implements AuthGateway {
  bool throwExistingAccount = false;
  bool switched = false;
  bool cancelled = false;

  /// Whether the player dismisses Google's sign-in when it opens.
  bool dismisses = false;

  @override
  AuthUser? get currentUser => const AuthUser(id: 'guest-1', isAnonymous: true);

  @override
  Stream<AuthStateChange> get authStateChanges => const Stream.empty();

  @override
  Future<void> signInAnonymously() async {}

  @override
  Future<AuthSignInResult> signInWithGoogle() async =>
      dismisses ? AuthSignInResult.cancelled : AuthSignInResult.signedIn;

  @override
  Future<void> signOut() async {}

  @override
  Future<AuthSignInResult> switchToExistingGoogleAccount() async {
    if (dismisses) return AuthSignInResult.cancelled;
    switched = true;
    return AuthSignInResult.signedIn;
  }

  @override
  Future<AuthUpgradeResult> upgradeWithGoogle() async => throwExistingAccount
      ? AuthUpgradeResult.existingAccount
      : AuthUpgradeResult.linked;

  @override
  void cancelExistingAccountSwitch() => cancelled = true;
}

final class _FakeAnalytics implements AnalyticsService {
  @override
  Future<void> friendAccepted() async {}

  @override
  Future<void> friendRequestSent() async {}

  @override
  Future<void> forfeit() async {}

  @override
  Future<void> gameCreated({
    required String gameId,
    required String access,
    required String timingMode,
    required bool rated,
  }) async {}

  @override
  Future<void> gameFinished({required String gameId}) async {}

  @override
  Future<void> gameStarted({
    required String gameId,
    required int playerCount,
  }) async {}

  @override
  Future<void> guestUpgraded() async {}

  @override
  Future<void> identify(String userId) async {}

  @override
  Future<void> joinByCode() async {}

  @override
  Future<void> reset() async {}

  @override
  Future<void> setAccountType({required bool isGuest}) async {}

  @override
  Future<void> wireEnumFallback({
    required String enumType,
    required String surface,
  }) async {}
}

void main() {
  test(
    'an existing Google account requires confirmation before switching',
    () async {
      final auth = _FakeAuthGateway()..throwExistingAccount = true;
      final container = makeContainer(
        overrides: [
          ...replicaTestOverrides(),
          syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
          authServiceProvider.overrideWithValue(auth),
          analyticsServiceProvider.overrideWithValue(_FakeAnalytics()),
          currentUserProvider.overrideWith(
            (ref) => const AuthUser(id: 'guest-1', isAnonymous: true),
          ),
        ],
      );

      final controller = container.read(authControllerProvider.notifier);
      final outcome = await controller.upgradeToGoogle();

      check(outcome).equals(UpgradeOutcome.existingAccount);
      check(auth.switched).isFalse();
      expect(container.read(authControllerProvider), isA<AsyncData<void>>());

      controller.cancelExistingAccountSwitch();
      check(auth.cancelled).isTrue();
      await check(controller.switchToExisting()).throws<StateError>();
      check(auth.switched).isFalse();
    },
  );

  test('a new Google account links without asking to switch', () async {
    final auth = _FakeAuthGateway();
    final container = makeContainer(
      overrides: [
        ...replicaTestOverrides(),
        syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
        authServiceProvider.overrideWithValue(auth),
        analyticsServiceProvider.overrideWithValue(_FakeAnalytics()),
        currentUserProvider.overrideWith(
          (ref) => const AuthUser(id: 'guest-1', isAnonymous: true),
        ),
      ],
    );

    final outcome = await container
        .read(authControllerProvider.notifier)
        .upgradeToGoogle();

    check(outcome).equals(UpgradeOutcome.linked);
    check(auth.switched).isFalse();
  });

  test('switches to the existing account only after confirmation', () async {
    final auth = _FakeAuthGateway()..throwExistingAccount = true;
    final container = makeContainer(
      overrides: [
        ...replicaTestOverrides(),
        syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
        authServiceProvider.overrideWithValue(auth),
        analyticsServiceProvider.overrideWithValue(_FakeAnalytics()),
        currentUserProvider.overrideWith(
          (ref) => const AuthUser(id: 'guest-1', isAnonymous: true),
        ),
      ],
    );

    final controller = container.read(authControllerProvider.notifier);
    await controller.upgradeToGoogle();
    check(await controller.switchToExisting()).isTrue();

    check(auth.switched).isTrue();
    expect(container.read(authControllerProvider), isA<AsyncData<void>>());
  });

  test('dismissing Google during a switch keeps the guest as it was', () async {
    final auth = _FakeAuthGateway()..throwExistingAccount = true;
    final container = makeContainer(
      overrides: [
        ...replicaTestOverrides(),
        syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
        authServiceProvider.overrideWithValue(auth),
        analyticsServiceProvider.overrideWithValue(_FakeAnalytics()),
        currentUserProvider.overrideWith(
          (ref) => const AuthUser(id: 'guest-1', isAnonymous: true),
        ),
      ],
    );

    final controller = container.read(authControllerProvider.notifier);
    await controller.upgradeToGoogle();
    auth.dismisses = true;

    check(await controller.switchToExisting()).isFalse();
    check(auth.switched).isFalse();
    expect(container.read(authControllerProvider), isA<AsyncData<void>>());
  });

  test('dismissing Google at sign-in is not an error', () async {
    final auth = _FakeAuthGateway()..dismisses = true;
    final container = makeContainer(
      overrides: [
        ...replicaTestOverrides(),
        syncCoordinatorProvider.overrideWith(_IdleSyncCoordinator.new),
        authServiceProvider.overrideWithValue(auth),
        analyticsServiceProvider.overrideWithValue(_FakeAnalytics()),
      ],
    );

    await container.read(authControllerProvider.notifier).signInWithGoogle();

    expect(container.read(authControllerProvider), isA<AsyncData<void>>());
  });
}

/// A sync coordinator that runs nothing: account changes trigger a sync, which
/// is not what these tests are about.
class _IdleSyncCoordinator extends SyncCoordinator {
  @override
  SyncStatus build() => (running: false, last: null);

  @override
  Future<SyncReport?> run() async => null;
}
