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

/// Brings one account's replica up to date with the server (decision 0013).
///
/// One pass, two steps, in this order: upload the games this device decides,
/// then pull the account. The order only saves a pass: a local game the upload
/// just finished arrives in the same pull that follows, where the reverse order
/// would leave it for the next trigger.
///
/// Nothing here decides *when* a pass runs; that is the caller's, and it is
/// always an event (app start, resume, reconnecting, pull-to-refresh, a push, a
/// local game finishing), never a timer. Single-flight: a trigger arriving
/// mid-pass joins the pass already running.
final class SyncPass {
  SyncPass({
    required this._replica,
    required this._public,
    required this._account,
    required this._games,
    required this._localGames,
    this._clock = DateTime.now,
    this._keptReplays = defaultKeptReplays,
  });

  final AccountReplica _replica;
  final PublicReplica _public;
  final AccountRepository _account;
  final GameRepository _games;
  final LocalGameSync _localGames;
  final DateTime Function() _clock;
  final int _keptReplays;

  Future<SyncReport>? _inFlight;

  /// Runs a pass, or joins the one already running.
  Future<SyncReport> run() {
    final running = _inFlight;
    if (running != null) return running;
    final pass = _run();
    _inFlight = pass;
    return pass.whenComplete(() => _inFlight = null);
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
        now: _clock(),
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
