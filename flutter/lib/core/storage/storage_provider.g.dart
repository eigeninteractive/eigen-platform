// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'storage_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// The device's own database: local games and persisted provider snapshots.
///
/// One connection for the session. A test overrides this with a database on
/// [NativeDatabase.memory].

@ProviderFor(localDatabase)
final localDatabaseProvider = LocalDatabaseProvider._();

/// The device's own database: local games and persisted provider snapshots.
///
/// One connection for the session. A test overrides this with a database on
/// [NativeDatabase.memory].

final class LocalDatabaseProvider
    extends
        $FunctionalProvider<
          AsyncValue<LocalDatabase>,
          LocalDatabase,
          FutureOr<LocalDatabase>
        >
    with $FutureModifier<LocalDatabase>, $FutureProvider<LocalDatabase> {
  /// The device's own database: local games and persisted provider snapshots.
  ///
  /// One connection for the session. A test overrides this with a database on
  /// [NativeDatabase.memory].
  LocalDatabaseProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'localDatabaseProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$localDatabaseHash();

  @$internal
  @override
  $FutureProviderElement<LocalDatabase> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<LocalDatabase> create(Ref ref) {
    return localDatabase(ref);
  }
}

String _$localDatabaseHash() => r'15f3ccd26fb5587a89faf0432772a829e1f4946d';

/// Storage backend for persisted Riverpod API snapshots.

@ProviderFor(storage)
final storageProvider = StorageProvider._();

/// Storage backend for persisted Riverpod API snapshots.

final class StorageProvider
    extends
        $FunctionalProvider<
          AsyncValue<Storage<String, String>>,
          Storage<String, String>,
          FutureOr<Storage<String, String>>
        >
    with
        $FutureModifier<Storage<String, String>>,
        $FutureProvider<Storage<String, String>> {
  /// Storage backend for persisted Riverpod API snapshots.
  StorageProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'storageProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$storageHash();

  @$internal
  @override
  $FutureProviderElement<Storage<String, String>> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<Storage<String, String>> create(Ref ref) {
    return storage(ref);
  }
}

String _$storageHash() => r'2503d934d8841abcb2e271e5a08f884d69a0cfd7';
