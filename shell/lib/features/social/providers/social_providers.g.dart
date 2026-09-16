// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'social_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(socialRepository)
final socialRepositoryProvider = SocialRepositoryProvider._();

final class SocialRepositoryProvider
    extends
        $FunctionalProvider<
          SocialRepository,
          SocialRepository,
          SocialRepository
        >
    with $Provider<SocialRepository> {
  SocialRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'socialRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$socialRepositoryHash();

  @$internal
  @override
  $ProviderElement<SocialRepository> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  SocialRepository create(Ref ref) {
    return socialRepository(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(SocialRepository value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<SocialRepository>(value),
    );
  }
}

String _$socialRepositoryHash() => r'107233b370a11a092470167df122bae1c4bee922';

/// The caller's accepted friends, from the replica.
///
/// Every change goes to the server and is followed by a sync pass, which
/// returns the friends and requests whole: that is how a request the server
/// auto-accepted, or a friend removed from another device, reaches this list.

@ProviderFor(Friends)
final friendsProvider = FriendsProvider._();

/// The caller's accepted friends, from the replica.
///
/// Every change goes to the server and is followed by a sync pass, which
/// returns the friends and requests whole: that is how a request the server
/// auto-accepted, or a friend removed from another device, reaches this list.
final class FriendsProvider
    extends $StreamNotifierProvider<Friends, List<Friend>> {
  /// The caller's accepted friends, from the replica.
  ///
  /// Every change goes to the server and is followed by a sync pass, which
  /// returns the friends and requests whole: that is how a request the server
  /// auto-accepted, or a friend removed from another device, reaches this list.
  FriendsProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'friendsProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$friendsHash();

  @$internal
  @override
  Friends create() => Friends();
}

String _$friendsHash() => r'6936c2368982e8a513f4ca3a47d6efe1e1da146f';

/// The caller's accepted friends, from the replica.
///
/// Every change goes to the server and is followed by a sync pass, which
/// returns the friends and requests whole: that is how a request the server
/// auto-accepted, or a friend removed from another device, reaches this list.

abstract class _$Friends extends $StreamNotifier<List<Friend>> {
  Stream<List<Friend>> build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<AsyncValue<List<Friend>>, List<Friend>>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<List<Friend>>, List<Friend>>,
              AsyncValue<List<Friend>>,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}

/// Pending requests in both directions, from the replica.

@ProviderFor(friendRequests)
final friendRequestsProvider = FriendRequestsProvider._();

/// Pending requests in both directions, from the replica.

final class FriendRequestsProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<FriendRequest>>,
          List<FriendRequest>,
          Stream<List<FriendRequest>>
        >
    with
        $FutureModifier<List<FriendRequest>>,
        $StreamProvider<List<FriendRequest>> {
  /// Pending requests in both directions, from the replica.
  FriendRequestsProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'friendRequestsProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$friendRequestsHash();

  @$internal
  @override
  $StreamProviderElement<List<FriendRequest>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<List<FriendRequest>> create(Ref ref) {
    return friendRequests(ref);
  }
}

String _$friendRequestsHash() => r'f293b753615e020fc9882f1e401300856390ef02';

/// Requests the caller received and can act on.

@ProviderFor(incomingRequests)
final incomingRequestsProvider = IncomingRequestsProvider._();

/// Requests the caller received and can act on.

final class IncomingRequestsProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<FriendRequest>>,
          List<FriendRequest>,
          FutureOr<List<FriendRequest>>
        >
    with
        $FutureModifier<List<FriendRequest>>,
        $FutureProvider<List<FriendRequest>> {
  /// Requests the caller received and can act on.
  IncomingRequestsProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'incomingRequestsProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$incomingRequestsHash();

  @$internal
  @override
  $FutureProviderElement<List<FriendRequest>> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<List<FriendRequest>> create(Ref ref) {
    return incomingRequests(ref);
  }
}

String _$incomingRequestsHash() => r'936cc7ee2caae1583641e9c61a00f4975194548f';

/// Requests the caller sent and can withdraw.

@ProviderFor(outgoingRequests)
final outgoingRequestsProvider = OutgoingRequestsProvider._();

/// Requests the caller sent and can withdraw.

final class OutgoingRequestsProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<FriendRequest>>,
          List<FriendRequest>,
          FutureOr<List<FriendRequest>>
        >
    with
        $FutureModifier<List<FriendRequest>>,
        $FutureProvider<List<FriendRequest>> {
  /// Requests the caller sent and can withdraw.
  OutgoingRequestsProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'outgoingRequestsProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$outgoingRequestsHash();

  @$internal
  @override
  $FutureProviderElement<List<FriendRequest>> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<List<FriendRequest>> create(Ref ref) {
    return outgoingRequests(ref);
  }
}

String _$outgoingRequestsHash() => r'2db8f6db28e606e188320c4ddc46661280867f2a';

/// Joinable games created by the caller's friends.
///
/// Not replicated: a list of games joinable right now is wrong as soon as it
/// is stale, and joining needs the network anyway.

@ProviderFor(friendsGames)
final friendsGamesProvider = FriendsGamesProvider._();

/// Joinable games created by the caller's friends.
///
/// Not replicated: a list of games joinable right now is wrong as soon as it
/// is stale, and joining needs the network anyway.

final class FriendsGamesProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<GameSummary>>,
          List<GameSummary>,
          FutureOr<List<GameSummary>>
        >
    with
        $FutureModifier<List<GameSummary>>,
        $FutureProvider<List<GameSummary>> {
  /// Joinable games created by the caller's friends.
  ///
  /// Not replicated: a list of games joinable right now is wrong as soon as it
  /// is stale, and joining needs the network anyway.
  FriendsGamesProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'friendsGamesProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$friendsGamesHash();

  @$internal
  @override
  $FutureProviderElement<List<GameSummary>> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<List<GameSummary>> create(Ref ref) {
    return friendsGames(ref);
  }
}

String _$friendsGamesHash() => r'b66fa0dc6cf0d0304b7b031e4eaca94a35ce7cd3';

@ProviderFor(friendStatus)
final friendStatusProvider = FriendStatusFamily._();

final class FriendStatusProvider
    extends
        $FunctionalProvider<
          AsyncValue<FriendStatus>,
          FriendStatus,
          FutureOr<FriendStatus>
        >
    with $FutureModifier<FriendStatus>, $FutureProvider<FriendStatus> {
  FriendStatusProvider._({
    required FriendStatusFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'friendStatusProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$friendStatusHash();

  @override
  String toString() {
    return r'friendStatusProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<FriendStatus> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<FriendStatus> create(Ref ref) {
    final argument = this.argument as String;
    return friendStatus(ref, targetId: argument);
  }

  @override
  bool operator ==(Object other) {
    return other is FriendStatusProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$friendStatusHash() => r'5b2fb974366aaece34a0cb0bab2ee27f2724f444';

final class FriendStatusFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<FriendStatus>, String> {
  FriendStatusFamily._()
    : super(
        retry: null,
        name: r'friendStatusProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  FriendStatusProvider call({required String targetId}) =>
      FriendStatusProvider._(argument: targetId, from: this);

  @override
  String toString() => r'friendStatusProvider';
}
