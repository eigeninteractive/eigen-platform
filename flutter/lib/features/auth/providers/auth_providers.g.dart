// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Application authentication boundary.
///
/// Production identity packages override this at the composition root. The
/// default keeps the embeddable Flutter package provider-neutral and signed
/// out.

@ProviderFor(authService)
final authServiceProvider = AuthServiceProvider._();

/// Application authentication boundary.
///
/// Production identity packages override this at the composition root. The
/// default keeps the embeddable Flutter package provider-neutral and signed
/// out.

final class AuthServiceProvider
    extends $FunctionalProvider<AuthGateway, AuthGateway, AuthGateway>
    with $Provider<AuthGateway> {
  /// Application authentication boundary.
  ///
  /// Production identity packages override this at the composition root. The
  /// default keeps the embeddable Flutter package provider-neutral and signed
  /// out.
  AuthServiceProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'authServiceProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$authServiceHash();

  @$internal
  @override
  $ProviderElement<AuthGateway> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  AuthGateway create(Ref ref) {
    return authService(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(AuthGateway value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<AuthGateway>(value),
    );
  }
}

String _$authServiceHash() => r'920a74d9124603dcaca710bca20bcb1b7786c488';

/// The signed-in user's id, or null when signed out.
///
/// Derived from the auth state stream. Because the value is a [String],
/// Riverpod's `==` check means dependents only rebuild when the id actually
/// changes; token refreshes re-emit the same id and propagate no further.

@ProviderFor(currentUserId)
final currentUserIdProvider = CurrentUserIdProvider._();

/// The signed-in user's id, or null when signed out.
///
/// Derived from the auth state stream. Because the value is a [String],
/// Riverpod's `==` check means dependents only rebuild when the id actually
/// changes; token refreshes re-emit the same id and propagate no further.

final class CurrentUserIdProvider
    extends $FunctionalProvider<String?, String?, String?>
    with $Provider<String?> {
  /// The signed-in user's id, or null when signed out.
  ///
  /// Derived from the auth state stream. Because the value is a [String],
  /// Riverpod's `==` check means dependents only rebuild when the id actually
  /// changes; token refreshes re-emit the same id and propagate no further.
  CurrentUserIdProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'currentUserIdProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$currentUserIdHash();

  @$internal
  @override
  $ProviderElement<String?> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  String? create(Ref ref) {
    return currentUserId(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(String? value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<String?>(value),
    );
  }
}

String _$currentUserIdHash() => r'e4b8eec05ee95bcd36cd6395d3a5f6e102323ac5';

/// Provider for current authenticated user.
///
/// Rebuilds when the signed-in user changes (sign-in, sign-out, account
/// switch) so user-scoped providers watching this re-key per account.

@ProviderFor(currentUser)
final currentUserProvider = CurrentUserProvider._();

/// Provider for current authenticated user.
///
/// Rebuilds when the signed-in user changes (sign-in, sign-out, account
/// switch) so user-scoped providers watching this re-key per account.

final class CurrentUserProvider
    extends $FunctionalProvider<AuthUser?, AuthUser?, AuthUser?>
    with $Provider<AuthUser?> {
  /// Provider for current authenticated user.
  ///
  /// Rebuilds when the signed-in user changes (sign-in, sign-out, account
  /// switch) so user-scoped providers watching this re-key per account.
  CurrentUserProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'currentUserProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$currentUserHash();

  @$internal
  @override
  $ProviderElement<AuthUser?> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  AuthUser? create(Ref ref) {
    return currentUser(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(AuthUser? value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<AuthUser?>(value),
    );
  }
}

String _$currentUserHash() => r'f64827b0cbcfcca07dbd7f57b1948f8fb25e17e0';

/// Provider for authentication state stream

@ProviderFor(authStateChanges)
final authStateChangesProvider = AuthStateChangesProvider._();

/// Provider for authentication state stream

final class AuthStateChangesProvider
    extends
        $FunctionalProvider<
          AsyncValue<AuthStateChange>,
          AuthStateChange,
          Stream<AuthStateChange>
        >
    with $FutureModifier<AuthStateChange>, $StreamProvider<AuthStateChange> {
  /// Provider for authentication state stream
  AuthStateChangesProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'authStateChangesProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$authStateChangesHash();

  @$internal
  @override
  $StreamProviderElement<AuthStateChange> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<AuthStateChange> create(Ref ref) {
    return authStateChanges(ref);
  }
}

String _$authStateChangesHash() => r'ee83d39078d728a4e5a0431d43cb29b07bb412f4';

/// Whether the current session is an anonymous (guest) session.
///
/// Watches the auth state stream (not [currentUserId]) so it re-evaluates on
/// `userUpdated` events: the id is unchanged when a guest upgrades, but the
/// `isAnonymous` claim flips to false. UI gates (social, rated games, upgrade
/// nudge) watch this; `==` on the bool keeps unrelated token refreshes inert.

@ProviderFor(isAnonymous)
final isAnonymousProvider = IsAnonymousProvider._();

/// Whether the current session is an anonymous (guest) session.
///
/// Watches the auth state stream (not [currentUserId]) so it re-evaluates on
/// `userUpdated` events: the id is unchanged when a guest upgrades, but the
/// `isAnonymous` claim flips to false. UI gates (social, rated games, upgrade
/// nudge) watch this; `==` on the bool keeps unrelated token refreshes inert.

final class IsAnonymousProvider extends $FunctionalProvider<bool, bool, bool>
    with $Provider<bool> {
  /// Whether the current session is an anonymous (guest) session.
  ///
  /// Watches the auth state stream (not [currentUserId]) so it re-evaluates on
  /// `userUpdated` events: the id is unchanged when a guest upgrades, but the
  /// `isAnonymous` claim flips to false. UI gates (social, rated games, upgrade
  /// nudge) watch this; `==` on the bool keeps unrelated token refreshes inert.
  IsAnonymousProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'isAnonymousProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$isAnonymousHash();

  @$internal
  @override
  $ProviderElement<bool> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  bool create(Ref ref) {
    return isAnonymous(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(bool value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<bool>(value),
    );
  }
}

String _$isAnonymousHash() => r'a3ce6ca6fe1fcea77ff0c2416113ec9de4188d7b';
