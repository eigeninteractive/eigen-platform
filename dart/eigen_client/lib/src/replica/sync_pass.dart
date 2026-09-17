import 'dart:async';

import '../local/local_game_sync.dart';
import '../repositories/account_repository.dart';
import '../repositories/game_repository.dart';
import 'account_replica.dart';
import 'public_replica.dart';

/// Ended online games whose replays the replica keeps, most recently opened
/// first. A replay beyond it is fetched again when opened.
const defaultKeptReplays = 200;

/// What one [SyncPass.run] did.
final class SyncReport {
  const SyncReport({required this.local, required this.error});

  /// What uploading the account's local games did.
  final LocalSyncReport local;

  /// Why pulling the account failed, or null when it completed. A failed pull
  /// changes nothing, so the replica still holds what the last good one did.
  final Object? error;

  /// Whether the replica now reflects the server.
  bool get pulled => error == null;
}

/// Keeps a pass's work from overlapping another pass over the same replica.
///
/// Runs [body] once no other body given to it is running. A replica only one
/// process opens needs nothing more than [SyncPass]'s own default; a replica
/// several processes share, such as browser tabs over one database, passes a
/// lock they all hold in common.
typedef SyncLock = Future<void> Function(Future<void> Function() body);

/// Brings one account's replica up to date with the server (decision 0013).
///
/// One pass, two steps, in this order: upload the games this device decides,
/// then pull the account. The order only saves a pass: a local game the upload
/// just finished arrives in the same pull that follows, where the reverse order
/// would leave it for the next trigger.
///
/// Nothing here decides *when* a pass is asked for; that is the caller's, and
/// it is always an event (app start, coming back to the app, reconnecting,
/// pull-to-refresh, a push, a local game finishing), never a timer. What this
/// decides is whether the request still needs a pass of its own (decision
/// 0014): passes never overlap, and a request is already answered once a pass
/// that began pulling after it was made has completed. So a burst of triggers,
/// from one process or from several sharing the replica, costs one pass rather
/// than one each.
final class SyncPass {
  SyncPass({
    required this._replica,
    required this._public,
    required this._account,
    required this._games,
    required this._localGames,
    SyncLock? lock,
    this._clock = DateTime.now,
    this._keptReplays = defaultKeptReplays,
  }) : _lock = lock ?? _serial();

  final AccountReplica _replica;
  final PublicReplica _public;
  final AccountRepository _account;
  final GameRepository _games;
  final LocalGameSync _localGames;
  final SyncLock _lock;
  final DateTime Function() _clock;
  final int _keptReplays;

  /// Runs a pass for a reason arising now, unless one that began pulling since
  /// then has completed by the time this one could start.
  ///
  /// Answers with the pass's report, or null when an earlier-started request's
  /// pass already brought the replica past this moment. A request arriving
  /// mid-pass waits for that pass rather than joining it, because a pull that
  /// began before the request may have missed what prompted it.
  Future<SyncReport?> run() async {
    final requestedAt = _clock();
    SyncReport? report;
    await _lock(() async {
      final syncedAt = await _replica.lastSyncedAt();
      if (syncedAt != null && !syncedAt.isBefore(requestedAt)) return;
      report = await _run();
    });
    return report;
  }

  /// A lock only this process holds: each body starts once the last has ended.
  static SyncLock _serial() {
    var tail = Future<void>.value();
    return (body) {
      final next = tail.then((_) => body());
      tail = next.then((_) {}, onError: (Object _) {});
      return next;
    };
  }

  Future<SyncReport> _run() async {
    final local = await _localGames.syncAll();
    try {
      await _pull();
      await _public.applyBots(await _games.getBots());
      await _replica.evictReplays(keep: _keptReplays);
      return SyncReport(local: local, error: null);
    } on Object catch (error) {
      return SyncReport(local: local, error: error);
    }
  }

  Future<void> _pull() async {
    // What the replica reflects once this pull completes: the server as of the
    // moment its first request went out, not when the last page landed.
    final pulledAt = _clock();
    var cursor = await _replica.finishedCursor();
    var response = await _account.sync(finishedAfter: cursor);
    if (cursor != null &&
        await _replica.createdAt() != response.account.createdAt) {
      // The account was deleted and created again under the same id. Its cursor
      // describes an account that no longer exists, so start over from empty
      // rather than asking the new one what changed since then.
      await _replica.resetReplicated();
      cursor = null;
      response = await _account.sync();
    }
    final ended = <String>{};
    final first = cursor == null;
    while (true) {
      ended.addAll(response.finishedGames.map((game) => game.id));
      final last = !response.hasMoreFinished;
      await _replica.applySync(
        response,
        first: first,
        endedSeen: last ? ended : null,
        pulledAt: pulledAt,
      );
      if (last) return;
      response = await _account.sync(finishedAfter: response.finishedCursor);
    }
  }

  /// Fetches one page of history older than the replica holds. Answers whether
  /// more remains after it.
  Future<bool> loadOlderHistory() async {
    final floor = await _replica.historyFloor();
    if (floor == null) return false;
    final page = await _account.finishedGames(cursor: floor);
    await _replica.applyOlderHistory(page);
    return page.nextCursor != null;
  }
}
