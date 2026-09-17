import 'dart:async';
import 'dart:js_interop';

import 'package:drift/drift.dart';
import 'package:drift/wasm.dart';
import 'package:web/web.dart' as web;

import 'answering_watch.dart';
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
  // Drift's enum lists its storages most reliable first, and memory, the last,
  // is always available.
  final storage = probe.availableStorages.reduce(
    (best, next) => next.index < best.index ? next : best,
  );
  final tabLock = '$name-tab';
  if (storage == WasmStorageImplementation.unsafeIndexedDb &&
      !await _TabLocks.take(tabLock)) {
    return _BrowserReplicaHost.heldElsewhere(_TabLocks.wait(tabLock));
  }
  var connection = await probe.open(storage, name);
  if (storage.storageApi == WebStorageApi.indexedDb) {
    connection = connection.interceptWith(
      _PersistToIndexedDb(connection.executor),
    );
  }
  // Outermost, so it times everything the database is asked, the line above
  // included.
  final watch = AnsweringWatch();
  return _BrowserReplicaHost(
    connection.interceptWith(watch),
    storage == WasmStorageImplementation.inMemory
        ? ReplicaStorage.ephemeral
        : ReplicaStorage.persistent,
    watch,
  );
}

/// Makes what the database writes durable in IndexedDB. Temporary: remove once
/// `eigen_flutter` is on a drift release carrying simolus3/drift#3865 (see
/// docs/blockers.md, "Drift does not persist IndexedDB transactions").
///
/// Drift's IndexedDB storage holds writes in memory and saves them only after a
/// statement run outside a transaction. In drift 2.35.0 neither of the two
/// writes that matter most is followed by one:
///
/// - A transaction's `COMMIT` still counts as inside the transaction, so nothing
///   it wrote is saved until some later, unrelated statement. Nearly every write
///   the replica makes is a transaction, including a local game's moves, which
///   exist nowhere else until uploaded.
/// - Opening a database writes its schema version last, after every migration
///   statement. Lost, it makes every later open fail creating tables that exist.
///
/// A tab that closes in between loses them. So after each outermost commit, and
/// once after opening, this runs one statement outside any transaction, which
/// is what makes drift save. A nested transaction is left alone: its writes are
/// saved with its outermost one, and the root cannot run a statement while that
/// is still open.
final class _PersistToIndexedDb extends QueryInterceptor {
  _PersistToIndexedDb(this._root);

  /// The connection's own executor, outside every transaction.
  final QueryExecutor _root;

  final _outermost = <TransactionExecutor>{};
  Future<void>? _opened;

  @override
  Future<bool> ensureOpen(
    QueryExecutor executor,
    QueryExecutorUser user,
  ) async {
    final opened = await executor.ensureOpen(user);
    if (identical(executor, _root)) {
      try {
        await (_opened ??= _save());
      } on Object {
        _opened = null;
        rethrow;
      }
    }
    return opened;
  }

  @override
  TransactionExecutor beginTransaction(QueryExecutor parent) {
    final transaction = parent.beginTransaction();
    if (identical(parent, _root)) _outermost.add(transaction);
    return transaction;
  }

  @override
  Future<void> commitTransaction(TransactionExecutor inner) async {
    // Only once the commit succeeded: drift may retry a failed one.
    await inner.send();
    if (_outermost.remove(inner)) await _save();
  }

  @override
  Future<void> rollbackTransaction(TransactionExecutor inner) {
    _outermost.remove(inner);
    return inner.rollback();
  }

  /// Any statement outside a transaction makes drift save what it holds; this
  /// one reads nothing.
  Future<void> _save() => _root.runCustom('SELECT 1');
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
  _BrowserReplicaHost(QueryExecutor this.executor, this.storage, this._watch)
    : available = Future.value();

  _BrowserReplicaHost.heldElsewhere(this.available)
    : executor = null,
      storage = ReplicaStorage.heldElsewhere,
      _watch = null;

  /// Null for a tab that opened nothing: it has no database to answer it.
  final AnsweringWatch? _watch;

  @override
  Stream<bool> get answering => _watch?.answering ?? Stream.value(true);

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
  Future<StoragePersistence> persistence() async {
    final storage = web.window.navigator.storage;
    if ((await storage.persisted().toDart).toDart) {
      return StoragePersistence.granted;
    }
    try {
      final status = await web.window.navigator.permissions
          .query({'name': 'persistent-storage'}.jsify()! as JSObject)
          .toDart;
      if (status.state == 'denied') return StoragePersistence.refused;
    } on Object {
      // A browser that does not name this permission decides for itself, and
      // asking it costs the player nothing.
    }
    return StoragePersistence.askable;
  }

  @override
  Future<StoragePersistence> requestPersistence() async =>
      (await web.window.navigator.storage.persist().toDart).toDart
      ? StoragePersistence.granted
      : StoragePersistence.refused;
}
