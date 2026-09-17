import 'package:eigen_flutter/features/auth/domain/auth_user.dart';

/// How a sign-in the player started ended, when it did not fail.
enum AuthSignInResult {
  /// The player is signed in.
  signedIn,

  /// The player closed or dismissed the provider's sign-in before finishing.
  /// Nothing changed, and there is nothing to report.
  cancelled,
}

/// Result of trying to turn a guest session into a Google-backed account.
enum AuthUpgradeResult {
  /// The Google identity now belongs to the guest's own account.
  linked,

  /// The Google identity already belongs to another account; switching to it
  /// needs the player's confirmation.
  existingAccount,

  /// The player dismissed the provider's sign-in. The guest is unchanged.
  cancelled,
}

/// The provider's sign-in could not open its window: in a browser, a pop-up
/// blocker refused it.
///
/// Unlike a cancellation this is not the player's choice, and unlike most
/// failures they can fix it themselves, so it is its own type for the app to
/// explain.
final class AuthWindowBlockedException implements Exception {
  const AuthWindowBlockedException();

  @override
  String toString() => 'The sign-in window was blocked.';
}

/// Authentication required by the Flutter presentation package.
///
/// Provider credentials are intentionally absent from this contract. An
/// adapter may retain a short-lived credential between [upgradeWithGoogle] and
/// [switchToExistingGoogleAccount], but the presentation layer only decides
/// whether the user confirmed that switch.
abstract interface class AuthGateway {
  AuthUser? get currentUser;
  Stream<AuthStateChange> get authStateChanges;
  Future<AuthSignInResult> signInWithGoogle();
  Future<void> signInAnonymously();
  Future<AuthUpgradeResult> upgradeWithGoogle();
  Future<AuthSignInResult> switchToExistingGoogleAccount();
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
  Future<AuthSignInResult> signInWithGoogle() async => _missing();

  @override
  Future<void> signInAnonymously() async => _missing();

  @override
  Future<AuthUpgradeResult> upgradeWithGoogle() async => _missing();

  @override
  Future<AuthSignInResult> switchToExistingGoogleAccount() async => _missing();

  @override
  void cancelExistingAccountSwitch() {}

  @override
  Future<void> signOut() async {}
}
