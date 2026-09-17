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

  /// Another tab of this app holds the database, in a browser whose storage
  /// for it is unsafe to share between tabs. This tab opens nothing until that
  /// tab closes.
  heldElsewhere,
}

/// Whether the browser keeps this site's storage when it runs short of space.
enum StoragePersistence {
  /// Kept: always so on a device, and in a browser that has granted it.
  granted,

  /// Not granted yet. Asking may show the player the browser's own prompt, so
  /// the app explains what it is for before it asks.
  askable,

  /// The browser will not keep it, because the player or the browser itself
  /// refused. Asking again shows nothing.
  refused,
}

/// The replica database as this platform opens it, and the few platform
/// capabilities that differ between a device and a browser (decisions 0013 and
/// 0014).
///
/// Opening a host is what decides its storage, so a host is only ever handed
/// out already knowing it.
abstract interface class ReplicaHost {
  /// The connection to open [ReplicaDatabase] over, or null when this tab may
  /// not open one ([ReplicaStorage.heldElsewhere]).
  QueryExecutor? get executor;

  /// What this host's storage is.
  ReplicaStorage get storage;

  /// Completes once a tab held elsewhere may open the replica, which is when
  /// the tab holding it closes. Opening again then succeeds. Already complete
  /// for every other host.
  Future<void> get available;

  /// Runs [body] while holding [name], so no other body under that name runs
  /// at the same time, in this process or in another tab of the app.
  Future<void> exclusively(String name, Future<void> Function() body);

  /// Whether the database answers, as it changes.
  ///
  /// A browser may terminate the worker holding the replica without telling the
  /// page, and a statement then never answers (decision 0014). False means the
  /// app should offer a reload, which opens everything again. Always true on a
  /// device, whose database is in this process.
  Stream<bool> get answering;

  /// Whether the browser keeps this site's storage under pressure.
  ///
  /// The replica itself re-syncs if it is evicted; what cannot be recovered is
  /// a local game not yet uploaded. Always [StoragePersistence.granted] on a
  /// device, which evicts nothing.
  Future<StoragePersistence> persistence();

  /// Asks the browser to keep this site's storage, and answers what it decided.
  ///
  /// Some browsers ask the player, so this belongs behind an explanation and a
  /// deliberate action, never a startup call.
  Future<StoragePersistence> requestPersistence();
}

/// Named locks that only this process takes: each body under a name starts
/// once the last one under it has ended. What [ReplicaHost.exclusively] needs
/// where there is only one process to exclude.
final class ProcessLocks {
  final _tails = <String, Future<void>>{};

  /// Runs [body] once every earlier body under [name] has ended.
  Future<void> exclusively(String name, Future<void> Function() body) {
    final next = (_tails[name] ?? Future<void>.value()).then((_) => body());
    _tails[name] = next.then((_) {}, onError: (Object _) {});
    return next;
  }
}
