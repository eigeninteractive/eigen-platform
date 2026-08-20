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
