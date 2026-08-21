import 'dart:async';
import 'dart:developer' as developer;

import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/core/storage/user_data_cache.dart';
import 'package:eigen_shell/features/profile/providers/profile_providers.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'auth_controller.g.dart';

/// Result of [AuthController.upgradeToGoogle], so the UI can tailor feedback.
enum UpgradeOutcome {
  /// The Google identity was linked to the existing guest account; all games,
  /// ratings, and friends are preserved.
  linked,

  /// The Google identity already belongs to an account. The UI must ask before
  /// abandoning guest progress and calling [AuthController.switchToExisting].
  existingAccount,
}

/// Manages first-party account actions and their operation state.
@Riverpod(keepAlive: true)
class AuthController extends _$AuthController {
  bool _hasPendingExistingAccount = false;

  @override
  AsyncValue<void> build() => const AsyncData(null);

  /// Signs in with Google.
  Future<void> signInWithGoogle() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(authServiceProvider).signInWithGoogle(),
    );
  }

  /// Starts an anonymous (guest) session.
  Future<void> signInAnonymously() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
      () => ref.read(authServiceProvider).signInAnonymously(),
    );
  }

  /// Upgrades the current guest session to a permanent Google account.
  ///
  /// A successful link preserves the user id, games, ratings, and friends. If
  /// the Google identity already belongs to an account, no session is changed;
  /// the UI must obtain confirmation before calling [switchToExisting].
  Future<UpgradeOutcome> upgradeToGoogle() async {
    state = const AsyncLoading();

    final authService = ref.read(authServiceProvider);
    final analytics = ref.read(analyticsServiceProvider);
    final guestId = ref.read(currentUserProvider)?.id;
    try {
      final result = await authService.upgradeWithGoogle();
      if (result == AuthUpgradeResult.existingAccount) {
        _hasPendingExistingAccount = true;
        state = const AsyncData(null);
        return UpgradeOutcome.existingAccount;
      }
      if (guestId != null) {
        ref.invalidate(currentUserProfileProvider);
        ref.invalidate(playerInfoCacheProvider(id: guestId));
      }
      unawaited(analytics.guestUpgraded());
      unawaited(analytics.setAccountType(isGuest: false));
      state = const AsyncData(null);
      return UpgradeOutcome.linked;
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      rethrow;
    }
  }

  /// Switches to the existing Google account selected by [upgradeToGoogle].
  ///
  /// This is separate from conflict detection so the UI can explain that guest
  /// progress cannot be transferred and obtain consent before local teardown.
  Future<void> switchToExisting() async {
    if (!_hasPendingExistingAccount) {
      throw StateError('No existing Google account switch is pending.');
    }

    state = const AsyncLoading();
    final guestId = ref.read(currentUserProvider)?.id;
    try {
      await ref.read(authServiceProvider).switchToExistingGoogleAccount();
      if (guestId != null) {
        try {
          await deleteUserData(ref, guestId);
        } catch (error, stackTrace) {
          developer.log(
            'Guest cache cleanup after account switch failed (ignored)',
            name: 'auth.controller',
            error: error,
            stackTrace: stackTrace,
          );
        }
      }
      state = const AsyncData(null);
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      rethrow;
    } finally {
      _hasPendingExistingAccount = false;
    }
  }

  /// Keeps the current guest session after the user declines an account switch.
  void cancelExistingAccountSwitch() {
    ref.read(authServiceProvider).cancelExistingAccountSwitch();
    _hasPendingExistingAccount = false;
  }

  /// Permanently deletes the current user's account.
  ///
  /// The server-side deletion runs before local sign-out so it still has an
  /// authenticated token. Sign-out is best-effort after the identity is gone.
  Future<void> deleteAccount() async {
    state = const AsyncLoading();

    state = await AsyncValue.guard(() async {
      final userId = ref.read(currentUserProvider)?.id;
      await ref.read(profileRepositoryProvider).deleteAccount();
      if (userId != null) await deleteUserData(ref, userId);
      try {
        await ref.read(authServiceProvider).signOut();
      } catch (error) {
        developer.log(
          'Sign-out after account deletion failed (ignored)',
          name: 'auth.controller',
          error: error,
        );
      }
    });
  }

  /// Signs out the current user and clears user-scoped local state.
  Future<void> signOut() async {
    state = const AsyncLoading();

    state = await AsyncValue.guard(() async {
      final userId = ref.read(currentUserProvider)?.id;
      if (userId != null) await deleteUserData(ref, userId);
      await ref.read(notificationServiceProvider).deleteCurrentInstallation();
      await ref.read(authServiceProvider).signOut();
    });
  }
}
