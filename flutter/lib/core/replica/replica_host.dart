import 'package:drift/drift.dart';

export 'replica_host_io.dart'
    if (dart.library.js_interop) 'replica_host_web.dart';

/// Whether what the replica stores outlives the page or the process.
enum ReplicaStorage {
  /// Rows survive a restart: a file on native, IndexedDB or OPFS in a browser.
  persistent,

  /// Nothing survives a reload. A browser that offers no persistent storage at
  /// all, such as some private windows, leaves only memory; the app says so,
  /// and offers no local play, whose games would be lost.
  ephemeral,

  /// Another tab of this app holds the database in a browser whose only
  /// persistent storage is unsafe to share between tabs. This tab opens
  /// nothing, and says the app is open elsewhere.
  heldElsewhere,
}

/// The replica database as this platform opens it, and the few platform
/// capabilities that differ between a device and a browser (decision 0013).
abstract interface class ReplicaHost {
  /// The connection to open [ReplicaDatabase] over, or null when this tab may
  /// not open one ([ReplicaStorage.heldElsewhere]).
  QueryExecutor? get executor;

  /// What the opened storage turned out to be. Completes once the database has
  /// actually opened, which a browser decides only then.
  Future<ReplicaStorage> get storage;

  /// Runs [body] while holding [name], so two tabs of the app never run it at
  /// once. Immediate on native, which has one process.
  Future<void> exclusively(String name, Future<void> Function() body);

  /// Asks the browser not to evict this site's storage under pressure. The
  /// replica itself re-syncs if evicted; what cannot be recovered is a local
  /// game not yet uploaded, so this is asked when one is first created. A
  /// no-op on native.
  Future<void> requestPersistence();
}
