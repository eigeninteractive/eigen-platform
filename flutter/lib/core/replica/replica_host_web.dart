import 'dart:async';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:drift/drift.dart';
import 'package:drift_flutter/drift_flutter.dart';
import 'package:web/web.dart' as web;

import 'replica_host.dart';

/// Opens the replica in the browser.
///
/// The shell cannot send the cross-origin isolation headers, because they break
/// the sign-in popup, so drift chooses among storage that needs shared workers
/// to be safe across tabs and IndexedDB without them, which drift documents as
/// unsafe for more than one tab. So without shared workers this tab first takes
/// an exclusive lock on the database for its whole lifetime, and a second tab
/// that cannot get it opens nothing.
Future<ReplicaHost> openReplicaHost({required String name}) async {
  if (!web.window.has('SharedWorker') && !await _holdForever('$name-tab')) {
    return _BrowserReplicaHost(
      null,
      Future.value(ReplicaStorage.heldElsewhere),
    );
  }
  final chosen = Completer<ReplicaStorage>();
  final executor = driftDatabase(
    name: name,
    web: DriftWebOptions(
      sqlite3Wasm: Uri.parse('sqlite3.wasm'),
      driftWorker: Uri.parse('drift_worker.js'),
      onResult: (result) => chosen.complete(
        result.chosenImplementation == WasmStorageImplementation.inMemory
            ? ReplicaStorage.ephemeral
            : ReplicaStorage.persistent,
      ),
    ),
  );
  return _BrowserReplicaHost(executor, chosen.future);
}

/// Takes [name] and never lets it go, answering whether it was free. The lock
/// is released only when the tab closes.
Future<bool> _holdForever(String name) {
  final granted = Completer<bool>();
  web.window.navigator.locks.request(
    name,
    web.LockOptions(ifAvailable: true),
    ((web.Lock? lock) {
      granted.complete(lock != null);
      // A promise that never settles is what holds the lock for the tab's life.
      return lock == null ? null : Completer<void>().future.toJS;
    }).toJS,
  );
  return granted.future;
}

final class _BrowserReplicaHost implements ReplicaHost {
  _BrowserReplicaHost(this.executor, this.storage);

  @override
  final QueryExecutor? executor;

  @override
  final Future<ReplicaStorage> storage;

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
