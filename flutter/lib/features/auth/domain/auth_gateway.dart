import 'package:eigen_flutter/features/auth/domain/auth_user.dart';

/// Result of trying to turn a guest session into a Google-backed account.
enum AuthUpgradeResult { linked, existingAccount }

/// Authentication required by the Flutter presentation package.
///
/// Provider credentials are intentionally absent from this contract. An
/// adapter may retain a short-lived credential between [upgradeWithGoogle] and
/// [switchToExistingGoogleAccount], but the presentation layer only decides
/// whether the user confirmed that switch.
abstract interface class AuthGateway {
  AuthUser? get currentUser;
  Stream<AuthStateChange> get authStateChanges;
  Future<void> signInWithGoogle();
  Future<void> signInAnonymously();
  Future<AuthUpgradeResult> upgradeWithGoogle();
  Future<void> switchToExistingGoogleAccount();
  void cancelExistingAccountSwitch();
  Future<void> signOut();
}

/// Authentication boundary used when an app has not installed an adapter.
///
/// It exposes a stable signed-out state so an embedding app can render before
/// choosing an identity provider. Operations that require identity fail with a
/// direct configuration error rather than a provider-specific exception.
final class UnavailableAuthGateway implements AuthGateway {
  const UnavailableAuthGateway();

  Never _missing() => throw UnsupportedError(
    'No AuthGateway is installed. Override authServiceProvider with an '
    'identity adapter.',
  );

  @override
  AuthUser? get currentUser => null;

  @override
  Stream<AuthStateChange> get authStateChanges => Stream.value(
    const AuthStateChange(event: AuthEvent.signedOut, user: null),
  );

  @override
  Future<void> signInWithGoogle() async => _missing();

  @override
  Future<void> signInAnonymously() async => _missing();

  @override
  Future<AuthUpgradeResult> upgradeWithGoogle() async => _missing();

  @override
  Future<void> switchToExistingGoogleAccount() async => _missing();

  @override
  void cancelExistingAccountSwitch() {}

  @override
  Future<void> signOut() async {}
}
