import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:eigen_flutter/features/auth/domain/auth_gateway.dart';
import 'package:eigen_flutter/features/auth/domain/auth_user.dart';

part 'auth_providers.g.dart';

/// Application authentication boundary.
///
/// Production identity packages override this at the composition root. The
/// default keeps the embeddable Flutter package provider-neutral and signed
/// out.
@Riverpod(keepAlive: true)
AuthGateway authService(Ref ref) => const UnavailableAuthGateway();

/// The signed-in user's id, or null when signed out.
///
/// Derived from the auth state stream. Because the value is a [String],
/// Riverpod's `==` check means dependents only rebuild when the id actually
/// changes; token refreshes re-emit the same id and propagate no further.
@riverpod
String? currentUserId(Ref ref) =>
    ref.watch(authStateChangesProvider).value?.user?.id;

/// Provider for current authenticated user.
///
/// Rebuilds when the signed-in user changes (sign-in, sign-out, account
/// switch) so user-scoped providers watching this re-key per account.
@riverpod
AuthUser? currentUser(Ref ref) {
  ref.watch(currentUserIdProvider);
  return ref.watch(authServiceProvider).currentUser;
}

/// Provider for authentication state stream
@riverpod
Stream<AuthStateChange> authStateChanges(Ref ref) {
  final authService = ref.watch(authServiceProvider);
  return authService.authStateChanges;
}

/// Whether the current session is an anonymous (guest) session.
///
/// Watches the auth state stream (not [currentUserId]) so it re-evaluates on
/// `userUpdated` events: the id is unchanged when a guest upgrades, but the
/// `isAnonymous` claim flips to false. UI gates (social, rated games, upgrade
/// nudge) watch this; `==` on the bool keeps unrelated token refreshes inert.
@riverpod
bool isAnonymous(Ref ref) {
  final user = ref.watch(authStateChangesProvider).value?.user;
  return user?.isAnonymous ?? false;
}
