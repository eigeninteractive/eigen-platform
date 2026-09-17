// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'replica_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// The platform's replica host: how this device or browser opens the database.
///
/// A browser tab that finds another tab holding the database opens nothing,
/// and opens again by itself once that tab closes.
///
/// A test overrides this with a host over an in-memory database.

@ProviderFor(replicaHost)
final replicaHostProvider = ReplicaHostProvider._();

/// The platform's replica host: how this device or browser opens the database.
///
/// A browser tab that finds another tab holding the database opens nothing,
/// and opens again by itself once that tab closes.
///
/// A test overrides this with a host over an in-memory database.

final class ReplicaHostProvider
    extends
        $FunctionalProvider<
          AsyncValue<ReplicaHost>,
          ReplicaHost,
          FutureOr<ReplicaHost>
        >
    with $FutureModifier<ReplicaHost>, $FutureProvider<ReplicaHost> {
  /// The platform's replica host: how this device or browser opens the database.
  ///
  /// A browser tab that finds another tab holding the database opens nothing,
  /// and opens again by itself once that tab closes.
  ///
  /// A test overrides this with a host over an in-memory database.
  ReplicaHostProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'replicaHostProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$replicaHostHash();

  @$internal
  @override
  $FutureProviderElement<ReplicaHost> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<ReplicaHost> create(Ref ref) {
    return replicaHost(ref);
  }
}

String _$replicaHostHash() => r'26be17e7ccbb88edcbaccdcae8455f8c40c2382c';

/// The device's replica database (decision 0013). One connection for the
/// session.
///
/// Fails with [ReplicaUnavailableException] in a browser tab that must not open
/// it because another tab holds it.

@ProviderFor(replicaDatabase)
final replicaDatabaseProvider = ReplicaDatabaseProvider._();

/// The device's replica database (decision 0013). One connection for the
/// session.
///
/// Fails with [ReplicaUnavailableException] in a browser tab that must not open
/// it because another tab holds it.

final class ReplicaDatabaseProvider
    extends
        $FunctionalProvider<
          AsyncValue<ReplicaDatabase>,
          ReplicaDatabase,
          FutureOr<ReplicaDatabase>
        >
    with $FutureModifier<ReplicaDatabase>, $FutureProvider<ReplicaDatabase> {
  /// The device's replica database (decision 0013). One connection for the
  /// session.
  ///
  /// Fails with [ReplicaUnavailableException] in a browser tab that must not open
  /// it because another tab holds it.
  ReplicaDatabaseProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'replicaDatabaseProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$replicaDatabaseHash();

  @$internal
  @override
  $FutureProviderElement<ReplicaDatabase> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<ReplicaDatabase> create(Ref ref) {
    return replicaDatabase(ref);
  }
}

String _$replicaDatabaseHash() => r'6f5b5807d733499e987f467c0d15fee73d6e6814';

/// Whether the replica answers (decision 0014).
///
/// False where the browser has taken the worker holding the database away
/// without telling the page: nothing the app reads or writes will complete, and
/// only reopening, which a reload does, recovers it.

@ProviderFor(replicaAnswering)
final replicaAnsweringProvider = ReplicaAnsweringProvider._();

/// Whether the replica answers (decision 0014).
///
/// False where the browser has taken the worker holding the database away
/// without telling the page: nothing the app reads or writes will complete, and
/// only reopening, which a reload does, recovers it.

final class ReplicaAnsweringProvider
    extends $FunctionalProvider<AsyncValue<bool>, bool, Stream<bool>>
    with $FutureModifier<bool>, $StreamProvider<bool> {
  /// Whether the replica answers (decision 0014).
  ///
  /// False where the browser has taken the worker holding the database away
  /// without telling the page: nothing the app reads or writes will complete, and
  /// only reopening, which a reload does, recovers it.
  ReplicaAnsweringProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'replicaAnsweringProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$replicaAnsweringHash();

  @$internal
  @override
  $StreamProviderElement<bool> $createElement($ProviderPointer pointer) =>
      $StreamProviderElement(pointer);

  @override
  Stream<bool> create(Ref ref) {
    return replicaAnswering(ref);
  }
}

String _$replicaAnsweringHash() => r'4ac1abbf814efd1067888c0cba50c2346442347c';

/// What the replica's storage is on this device or in this tab.

@ProviderFor(replicaStorage)
final replicaStorageProvider = ReplicaStorageProvider._();

/// What the replica's storage is on this device or in this tab.

final class ReplicaStorageProvider
    extends
        $FunctionalProvider<
          AsyncValue<ReplicaStorage>,
          ReplicaStorage,
          FutureOr<ReplicaStorage>
        >
    with $FutureModifier<ReplicaStorage>, $FutureProvider<ReplicaStorage> {
  /// What the replica's storage is on this device or in this tab.
  ReplicaStorageProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'replicaStorageProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$replicaStorageHash();

  @$internal
  @override
  $FutureProviderElement<ReplicaStorage> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<ReplicaStorage> create(Ref ref) {
    return replicaStorage(ref);
  }
}

String _$replicaStorageHash() => r'78da2fe08471136f15df4991bc2f053498cbd547';

/// The replica's public reference data: identities, bots, ratings.

@ProviderFor(publicReplica)
final publicReplicaProvider = PublicReplicaProvider._();

/// The replica's public reference data: identities, bots, ratings.

final class PublicReplicaProvider
    extends
        $FunctionalProvider<
          AsyncValue<PublicReplica>,
          PublicReplica,
          FutureOr<PublicReplica>
        >
    with $FutureModifier<PublicReplica>, $FutureProvider<PublicReplica> {
  /// The replica's public reference data: identities, bots, ratings.
  PublicReplicaProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'publicReplicaProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$publicReplicaHash();

  @$internal
  @override
  $FutureProviderElement<PublicReplica> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<PublicReplica> create(Ref ref) {
    return publicReplica(ref);
  }
}

String _$publicReplicaHash() => r'51e2a6c9df2460791f309330e6388d126572bede';

/// The signed-in account's replica, or null when nobody is signed in.

@ProviderFor(accountReplica)
final accountReplicaProvider = AccountReplicaProvider._();

/// The signed-in account's replica, or null when nobody is signed in.

final class AccountReplicaProvider
    extends
        $FunctionalProvider<
          AsyncValue<AccountReplica?>,
          AccountReplica?,
          FutureOr<AccountReplica?>
        >
    with $FutureModifier<AccountReplica?>, $FutureProvider<AccountReplica?> {
  /// The signed-in account's replica, or null when nobody is signed in.
  AccountReplicaProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'accountReplicaProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$accountReplicaHash();

  @$internal
  @override
  $FutureProviderElement<AccountReplica?> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<AccountReplica?> create(Ref ref) {
    return accountReplica(ref);
  }
}

String _$accountReplicaHash() => r'4ae90ea4b37e678a1619c81d3c15e1927503a2f5';

/// Where the games this device decides are stored.

@ProviderFor(localGameStorage)
final localGameStorageProvider = LocalGameStorageProvider._();

/// Where the games this device decides are stored.

final class LocalGameStorageProvider
    extends
        $FunctionalProvider<
          AsyncValue<LocalGameStorage>,
          LocalGameStorage,
          FutureOr<LocalGameStorage>
        >
    with $FutureModifier<LocalGameStorage>, $FutureProvider<LocalGameStorage> {
  /// Where the games this device decides are stored.
  LocalGameStorageProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'localGameStorageProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$localGameStorageHash();

  @$internal
  @override
  $FutureProviderElement<LocalGameStorage> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<LocalGameStorage> create(Ref ref) {
    return localGameStorage(ref);
  }
}

String _$localGameStorageHash() => r'b04fe9c26a36df0dd370d28387b3894a31a1eb84';
