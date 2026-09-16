// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profile_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Provider for the signed-in account's repository.

@ProviderFor(accountRepository)
final accountRepositoryProvider = AccountRepositoryProvider._();

/// Provider for the signed-in account's repository.

final class AccountRepositoryProvider
    extends
        $FunctionalProvider<
          AccountRepository,
          AccountRepository,
          AccountRepository
        >
    with $Provider<AccountRepository> {
  /// Provider for the signed-in account's repository.
  AccountRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'accountRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$accountRepositoryHash();

  @$internal
  @override
  $ProviderElement<AccountRepository> $createElement(
    $ProviderPointer pointer,
  ) => $ProviderElement(pointer);

  @override
  AccountRepository create(Ref ref) {
    return accountRepository(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(AccountRepository value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<AccountRepository>(value),
    );
  }
}

String _$accountRepositoryHash() => r'41f8d6ce723665603a1c5666c99f381ceb82c69d';

/// Provider for AvatarStorageService instance.

@ProviderFor(avatarStorageService)
final avatarStorageServiceProvider = AvatarStorageServiceProvider._();

/// Provider for AvatarStorageService instance.

final class AvatarStorageServiceProvider
    extends
        $FunctionalProvider<
          AvatarStorageService,
          AvatarStorageService,
          AvatarStorageService
        >
    with $Provider<AvatarStorageService> {
  /// Provider for AvatarStorageService instance.
  AvatarStorageServiceProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'avatarStorageServiceProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$avatarStorageServiceHash();

  @$internal
  @override
  $ProviderElement<AvatarStorageService> $createElement(
    $ProviderPointer pointer,
  ) => $ProviderElement(pointer);

  @override
  AvatarStorageService create(Ref ref) {
    return avatarStorageService(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(AvatarStorageService value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<AvatarStorageService>(value),
    );
  }
}

String _$avatarStorageServiceHash() =>
    r'7b26fe6852ed1c85b26b5ec31b4b937806210761';

/// The signed-in user's own profile, from the replica.
///
/// Answers straight away from what the device holds, offline included, and
/// waits for the first sync on a device that holds nothing yet.

@ProviderFor(currentUserProfile)
final currentUserProfileProvider = CurrentUserProfileProvider._();

/// The signed-in user's own profile, from the replica.
///
/// Answers straight away from what the device holds, offline included, and
/// waits for the first sync on a device that holds nothing yet.

final class CurrentUserProfileProvider
    extends $FunctionalProvider<AsyncValue<Profile>, Profile, Stream<Profile>>
    with $FutureModifier<Profile>, $StreamProvider<Profile> {
  /// The signed-in user's own profile, from the replica.
  ///
  /// Answers straight away from what the device holds, offline included, and
  /// waits for the first sync on a device that holds nothing yet.
  CurrentUserProfileProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'currentUserProfileProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$currentUserProfileHash();

  @$internal
  @override
  $StreamProviderElement<Profile> $createElement($ProviderPointer pointer) =>
      $StreamProviderElement(pointer);

  @override
  Stream<Profile> create(Ref ref) {
    return currentUserProfile(ref);
  }
}

String _$currentUserProfileHash() =>
    r'a16fa9fdfed2bea37df6f351de31dc63f81e6cd2';

/// Changes to the signed-in user's profile.
///
/// Every change answers with the whole updated profile, which is written to
/// the replica as it arrives: the server derives fields the client does not
/// send (it stamps `avatarUrl` itself on upload, cache-buster included), so the
/// replica holds what every other client sees rather than a local patch, and a
/// change that half-succeeded holds exactly the half that did.

@ProviderFor(ProfileEditor)
final profileEditorProvider = ProfileEditorProvider._();

/// Changes to the signed-in user's profile.
///
/// Every change answers with the whole updated profile, which is written to
/// the replica as it arrives: the server derives fields the client does not
/// send (it stamps `avatarUrl` itself on upload, cache-buster included), so the
/// replica holds what every other client sees rather than a local patch, and a
/// change that half-succeeded holds exactly the half that did.
final class ProfileEditorProvider
    extends $NotifierProvider<ProfileEditor, void> {
  /// Changes to the signed-in user's profile.
  ///
  /// Every change answers with the whole updated profile, which is written to
  /// the replica as it arrives: the server derives fields the client does not
  /// send (it stamps `avatarUrl` itself on upload, cache-buster included), so the
  /// replica holds what every other client sees rather than a local patch, and a
  /// change that half-succeeded holds exactly the half that did.
  ProfileEditorProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'profileEditorProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$profileEditorHash();

  @$internal
  @override
  ProfileEditor create() => ProfileEditor();

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(void value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<void>(value),
    );
  }
}

String _$profileEditorHash() => r'0ee4f996c8a0f4f69622cc82f65c2add4799460f';

/// Changes to the signed-in user's profile.
///
/// Every change answers with the whole updated profile, which is written to
/// the replica as it arrives: the server derives fields the client does not
/// send (it stamps `avatarUrl` itself on upload, cache-buster included), so the
/// replica holds what every other client sees rather than a local patch, and a
/// change that half-succeeded holds exactly the half that did.

abstract class _$ProfileEditor extends $Notifier<void> {
  void build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<void, void>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<void, void>,
              void,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
