// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'account_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// The signed-in account's own profile, or null before its first sync.

@ProviderFor(accountProfile)
final accountProfileProvider = AccountProfileProvider._();

/// The signed-in account's own profile, or null before its first sync.

final class AccountProfileProvider
    extends
        $FunctionalProvider<AsyncValue<Profile?>, Profile?, Stream<Profile?>>
    with $FutureModifier<Profile?>, $StreamProvider<Profile?> {
  /// The signed-in account's own profile, or null before its first sync.
  AccountProfileProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'accountProfileProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$accountProfileHash();

  @$internal
  @override
  $StreamProviderElement<Profile?> $createElement($ProviderPointer pointer) =>
      $StreamProviderElement(pointer);

  @override
  Stream<Profile?> create(Ref ref) {
    return accountProfile(ref);
  }
}

String _$accountProfileHash() => r'f8bbd419b5eb5f2d59c5b71da3882f75347df68c';

/// The signed-in account's display ratings, best first.

@ProviderFor(accountRatings)
final accountRatingsProvider = AccountRatingsProvider._();

/// The signed-in account's display ratings, best first.

final class AccountRatingsProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<Rating>>,
          List<Rating>,
          Stream<List<Rating>>
        >
    with $FutureModifier<List<Rating>>, $StreamProvider<List<Rating>> {
  /// The signed-in account's display ratings, best first.
  AccountRatingsProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'accountRatingsProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$accountRatingsHash();

  @$internal
  @override
  $StreamProviderElement<List<Rating>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<List<Rating>> create(Ref ref) {
    return accountRatings(ref);
  }
}

String _$accountRatingsHash() => r'1e98f5903a3a7275429338d4cebe2b559036ed3d';

/// The signed-in account's accepted friends.

@ProviderFor(accountFriends)
final accountFriendsProvider = AccountFriendsProvider._();

/// The signed-in account's accepted friends.

final class AccountFriendsProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<Friend>>,
          List<Friend>,
          Stream<List<Friend>>
        >
    with $FutureModifier<List<Friend>>, $StreamProvider<List<Friend>> {
  /// The signed-in account's accepted friends.
  AccountFriendsProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'accountFriendsProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$accountFriendsHash();

  @$internal
  @override
  $StreamProviderElement<List<Friend>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<List<Friend>> create(Ref ref) {
    return accountFriends(ref);
  }
}

String _$accountFriendsHash() => r'2d7e69cd08a19c6255496f6c8bb9a068c8badca7';

/// The signed-in account's pending requests, in both directions.

@ProviderFor(accountFriendRequests)
final accountFriendRequestsProvider = AccountFriendRequestsProvider._();

/// The signed-in account's pending requests, in both directions.

final class AccountFriendRequestsProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<FriendRequest>>,
          List<FriendRequest>,
          Stream<List<FriendRequest>>
        >
    with
        $FutureModifier<List<FriendRequest>>,
        $StreamProvider<List<FriendRequest>> {
  /// The signed-in account's pending requests, in both directions.
  AccountFriendRequestsProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'accountFriendRequestsProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$accountFriendRequestsHash();

  @$internal
  @override
  $StreamProviderElement<List<FriendRequest>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<List<FriendRequest>> create(Ref ref) {
    return accountFriendRequests(ref);
  }
}

String _$accountFriendRequestsHash() =>
    r'8cbb7a53731a53467c675af97fa8bd6170609cf1';

/// When the signed-in account last synced, and whether older history remains
/// on the server.

@ProviderFor(accountHistory)
final accountHistoryProvider = AccountHistoryProvider._();

/// When the signed-in account last synced, and whether older history remains
/// on the server.

final class AccountHistoryProvider
    extends
        $FunctionalProvider<
          AsyncValue<HistoryState>,
          HistoryState,
          Stream<HistoryState>
        >
    with $FutureModifier<HistoryState>, $StreamProvider<HistoryState> {
  /// When the signed-in account last synced, and whether older history remains
  /// on the server.
  AccountHistoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'accountHistoryProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$accountHistoryHash();

  @$internal
  @override
  $StreamProviderElement<HistoryState> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<HistoryState> create(Ref ref) {
    return accountHistory(ref);
  }
}

String _$accountHistoryHash() => r'573e2844c299128cff7de7f2678afa24ace7b8f1';
