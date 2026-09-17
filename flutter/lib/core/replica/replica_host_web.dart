import 'dart:async';
import 'dart:js_interop';

import 'package:drift/drift.dart';
import 'package:drift/wasm.dart';
import 'package:web/web.dart' as web;

import 'replica_host.dart';

/// Where drift's web runtime is served from: this package's own web assets.
const _runtime = 'assets/packages/eigen_flutter/assets/drift';

/// Opens the replica in the browser (decision 0014).
///
/// Storage is chosen before anything opens, because whether this tab may open
/// the database at all depends on which storage it is. The shell cannot send
/// the cross-origin isolation headers, which break the sign-in popup, so a
/// browser offers some of: storage one shared worker hosts for every tab
/// (`opfsShared`, `sharedIndexedDb`), IndexedDB in this tab's own worker
/// (`unsafeIndexedDb`), and memory. Drift prefers them in that order, and so
/// does this. The middle one is unsafe the moment two tabs write it, so under
/// it this tab opens the database only while holding the database's tab lock,
/// and a tab that finds it held waits for it rather than opening.
Future<ReplicaHost> openReplicaHost({required String name}) async {
  final probe = await WasmDatabase.probe(
    sqlite3Uri: _asset('sqlite3.wasm'),
    driftWorkerUri: _asset('drift_worker.js'),
    databaseName: name,
  );
  final storage = _choose(probe, name);
  final tabLock = '$name-tab';
  if (storage == WasmStorageImplementation.unsafeIndexedDb &&
      !await _TabLocks.take(tabLock)) {
    return _BrowserReplicaHost.heldElsewhere(_TabLocks.wait(tabLock));
  }
  var connection = await probe.open(storage, name);
  if (storage.storageApi == WebStorageApi.indexedDb) {
    connection = connection.interceptWith(_PersistOpening());
  }
  return _BrowserReplicaHost(
    connection,
    storage == WasmStorageImplementation.inMemory
        ? ReplicaStorage.ephemeral
        : ReplicaStorage.persistent,
  );
}

/// Makes opening the database durable in IndexedDB.
///
/// Drift's IndexedDB storage holds a write in memory until a later statement
/// runs outside a transaction, and the last thing opening a database writes is
/// its schema version, after every migration statement has already been saved.
/// A tab that closes before writing anything else loses just that, and every
/// later open then runs the creating migration against tables that exist, and
/// fails, for good. So one statement runs straight after the first open.
/// (drift 2.35.0; `Sqlite3Delegate.setSchemaVersion` does not flush.)
final class _PersistOpening extends QueryInterceptor {
  Future<void>? _persisted;

  @override
  Future<bool> ensureOpen(
    QueryExecutor executor,
    QueryExecutorUser user,
  ) async {
    final opened = await executor.ensureOpen(user);
    try {
      await (_persisted ??= executor.runCustom('SELECT 1'));
    } on Object {
      _persisted = null;
      rethrow;
    }
    return opened;
  }
}

/// The most reliable storage the browser offers, except that a database that
/// already exists stays in the storage it is in: any other would open empty.
WasmStorageImplementation _choose(WasmProbeResult probe, String name) {
  final available = [...probe.availableStorages]
    ..sort((a, b) => a.index.compareTo(b.index));
  final existing = {
    for (final (api, database) in probe.existingDatabases)
      if (database == name) api,
  };
  for (final storage in available) {
    if (existing.contains(storage.storageApi)) return storage;
  }
  return available.firstOrNull ?? WasmStorageImplementation.inMemory;
}

Uri _asset(String file) =>
    Uri.parse(web.document.baseURI).resolve('$_runtime/$file');

/// Locks this tab takes for the rest of its life: released only when it closes.
abstract final class _TabLocks {
  static final _held = <String>{};

  /// Takes [name] if it is free, answering whether this tab now holds it.
  static Future<bool> take(String name) async =>
      _held.contains(name) || await _request(name, ifAvailable: true);

  /// Completes once this tab holds [name], however long another tab keeps it.
  static Future<void> wait(String name) =>
      _request(name, ifAvailable: false).then((_) {});

  static Future<bool> _request(String name, {required bool ifAvailable}) {
    final granted = Completer<bool>();
    web.window.navigator.locks.request(
      name,
      web.LockOptions(ifAvailable: ifAvailable),
      ((web.Lock? lock) {
        if (lock == null) {
          granted.complete(false);
          return null;
        }
        _held.add(name);
        granted.complete(true);
        // A promise that never settles is what holds the lock for the tab's
        // life.
        return Completer<void>().future.toJS;
      }).toJS,
    );
    return granted.future;
  }
}

final class _BrowserReplicaHost implements ReplicaHost {
  _BrowserReplicaHost(QueryExecutor this.executor, this.storage)
    : available = Future.value();

  _BrowserReplicaHost.heldElsewhere(this.available)
    : executor = null,
      storage = ReplicaStorage.heldElsewhere;

  @override
  final QueryExecutor? executor;

  @override
  final ReplicaStorage storage;

  @override
  final Future<void> available;

  @override
  Future<void> exclusively(String name, Future<void> Function() body) async {
    await web.window.navigator.locks
        .request(name, ((web.Lock? _) => body().toJS).toJS)
        .toDart;
  }

  @override
  Future<void> requestPersistence() async {
    await web.window.navigator.storage.persist().toDart;
  }
}
