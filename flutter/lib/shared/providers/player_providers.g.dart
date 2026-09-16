// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'player_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// Singleton [PlayerRepository] instance.

@ProviderFor(playerRepository)
final playerRepositoryProvider = PlayerRepositoryProvider._();

/// Singleton [PlayerRepository] instance.

final class PlayerRepositoryProvider
    extends
        $FunctionalProvider<
          PlayerRepository,
          PlayerRepository,
          PlayerRepository
        >
    with $Provider<PlayerRepository> {
  /// Singleton [PlayerRepository] instance.
  PlayerRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'playerRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$playerRepositoryHash();

  @$internal
  @override
  $ProviderElement<PlayerRepository> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  PlayerRepository create(Ref ref) {
    return playerRepository(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(PlayerRepository value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<PlayerRepository>(value),
    );
  }
}

String _$playerRepositoryHash() => r'6202fe72c9790427173076d60d04415b08d1feae';

/// Coalesces identity lookups into one batch request.
///
/// A session-lived singleton so its batching window spans the whole app: every
/// id a single widget build finds missing from the replica funnels through one
/// [PlayerBatchLoader] and one network call.

@ProviderFor(playerBatchLoader)
final playerBatchLoaderProvider = PlayerBatchLoaderProvider._();

/// Coalesces identity lookups into one batch request.
///
/// A session-lived singleton so its batching window spans the whole app: every
/// id a single widget build finds missing from the replica funnels through one
/// [PlayerBatchLoader] and one network call.

final class PlayerBatchLoaderProvider
    extends
        $FunctionalProvider<
          PlayerBatchLoader,
          PlayerBatchLoader,
          PlayerBatchLoader
        >
    with $Provider<PlayerBatchLoader> {
  /// Coalesces identity lookups into one batch request.
  ///
  /// A session-lived singleton so its batching window spans the whole app: every
  /// id a single widget build finds missing from the replica funnels through one
  /// [PlayerBatchLoader] and one network call.
  PlayerBatchLoaderProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'playerBatchLoaderProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$playerBatchLoaderHash();

  @$internal
  @override
  $ProviderElement<PlayerBatchLoader> $createElement(
    $ProviderPointer pointer,
  ) => $ProviderElement(pointer);

  @override
  PlayerBatchLoader create(Ref ref) {
    return playerBatchLoader(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(PlayerBatchLoader value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<PlayerBatchLoader>(value),
    );
  }
}

String _$playerBatchLoaderHash() => r'b304409a3f6b309cde08d35a10fd8138c53ce989';

/// One human's public identity, from the replica.
///
/// The sync pass stores the identity of everyone seated in the account's games
/// and of its friends, so this is almost always a read. An id the replica does
/// not hold yet (a lobby seat, a player found by search) is fetched once and
/// stored. An id the server no longer knows is a deleted account: it is dropped
/// from the replica and this answers null, which a seat renders as deleted
/// (decision 0007). Offline, a missing identity simply stays null until a lookup
/// can succeed.

@ProviderFor(playerIdentity)
final playerIdentityProvider = PlayerIdentityFamily._();

/// One human's public identity, from the replica.
///
/// The sync pass stores the identity of everyone seated in the account's games
/// and of its friends, so this is almost always a read. An id the replica does
/// not hold yet (a lobby seat, a player found by search) is fetched once and
/// stored. An id the server no longer knows is a deleted account: it is dropped
/// from the replica and this answers null, which a seat renders as deleted
/// (decision 0007). Offline, a missing identity simply stays null until a lookup
/// can succeed.

final class PlayerIdentityProvider
    extends $FunctionalProvider<AsyncValue<Player?>, Player?, Stream<Player?>>
    with $FutureModifier<Player?>, $StreamProvider<Player?> {
  /// One human's public identity, from the replica.
  ///
  /// The sync pass stores the identity of everyone seated in the account's games
  /// and of its friends, so this is almost always a read. An id the replica does
  /// not hold yet (a lobby seat, a player found by search) is fetched once and
  /// stored. An id the server no longer knows is a deleted account: it is dropped
  /// from the replica and this answers null, which a seat renders as deleted
  /// (decision 0007). Offline, a missing identity simply stays null until a lookup
  /// can succeed.
  PlayerIdentityProvider._({
    required PlayerIdentityFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'playerIdentityProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$playerIdentityHash();

  @override
  String toString() {
    return r'playerIdentityProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $StreamProviderElement<Player?> $createElement($ProviderPointer pointer) =>
      $StreamProviderElement(pointer);

  @override
  Stream<Player?> create(Ref ref) {
    final argument = this.argument as String;
    return playerIdentity(ref, id: argument);
  }

  @override
  bool operator ==(Object other) {
    return other is PlayerIdentityProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$playerIdentityHash() => r'dab8363abfe37dc38df4e43f89c60a55d6d148a8';

/// One human's public identity, from the replica.
///
/// The sync pass stores the identity of everyone seated in the account's games
/// and of its friends, so this is almost always a read. An id the replica does
/// not hold yet (a lobby seat, a player found by search) is fetched once and
/// stored. An id the server no longer knows is a deleted account: it is dropped
/// from the replica and this answers null, which a seat renders as deleted
/// (decision 0007). Offline, a missing identity simply stays null until a lookup
/// can succeed.

final class PlayerIdentityFamily extends $Family
    with $FunctionalFamilyOverride<Stream<Player?>, String> {
  PlayerIdentityFamily._()
    : super(
        retry: null,
        name: r'playerIdentityProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// One human's public identity, from the replica.
  ///
  /// The sync pass stores the identity of everyone seated in the account's games
  /// and of its friends, so this is almost always a read. An id the replica does
  /// not hold yet (a lobby seat, a player found by search) is fetched once and
  /// stored. An id the server no longer knows is a deleted account: it is dropped
  /// from the replica and this answers null, which a seat renders as deleted
  /// (decision 0007). Offline, a missing identity simply stays null until a lookup
  /// can succeed.

  PlayerIdentityProvider call({required String id}) =>
      PlayerIdentityProvider._(argument: id, from: this);

  @override
  String toString() => r'playerIdentityProvider';
}

/// The identity a seat renders: a human's from the replica, a bot's from the
/// catalog. Null for a seat whose account is gone, or while offline for a human
/// the device has never seen.

@ProviderFor(seatIdentity)
final seatIdentityProvider = SeatIdentityFamily._();

/// The identity a seat renders: a human's from the replica, a bot's from the
/// catalog. Null for a seat whose account is gone, or while offline for a human
/// the device has never seen.

final class SeatIdentityProvider
    extends $FunctionalProvider<AsyncValue<Player?>, Player?, FutureOr<Player?>>
    with $FutureModifier<Player?>, $FutureProvider<Player?> {
  /// The identity a seat renders: a human's from the replica, a bot's from the
  /// catalog. Null for a seat whose account is gone, or while offline for a human
  /// the device has never seen.
  SeatIdentityProvider._({
    required SeatIdentityFamily super.from,
    required ({String? userId, String? botId}) super.argument,
  }) : super(
         retry: null,
         name: r'seatIdentityProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$seatIdentityHash();

  @override
  String toString() {
    return r'seatIdentityProvider'
        ''
        '$argument';
  }

  @$internal
  @override
  $FutureProviderElement<Player?> $createElement($ProviderPointer pointer) =>
      $FutureProviderElement(pointer);

  @override
  FutureOr<Player?> create(Ref ref) {
    final argument = this.argument as ({String? userId, String? botId});
    return seatIdentity(ref, userId: argument.userId, botId: argument.botId);
  }

  @override
  bool operator ==(Object other) {
    return other is SeatIdentityProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$seatIdentityHash() => r'1ee97cdd5b5c42ebbb16fe1ecb08ddcb108cec36';

/// The identity a seat renders: a human's from the replica, a bot's from the
/// catalog. Null for a seat whose account is gone, or while offline for a human
/// the device has never seen.

final class SeatIdentityFamily extends $Family
    with
        $FunctionalFamilyOverride<
          FutureOr<Player?>,
          ({String? userId, String? botId})
        > {
  SeatIdentityFamily._()
    : super(
        retry: null,
        name: r'seatIdentityProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// The identity a seat renders: a human's from the replica, a bot's from the
  /// catalog. Null for a seat whose account is gone, or while offline for a human
  /// the device has never seen.

  SeatIdentityProvider call({String? userId, String? botId}) =>
      SeatIdentityProvider._(
        argument: (userId: userId, botId: botId),
        from: this,
      );

  @override
  String toString() => r'seatIdentityProvider';
}
