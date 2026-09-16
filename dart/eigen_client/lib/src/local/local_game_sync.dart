import 'dart:async';

import 'package:eigen_api/eigen_api.dart';

import '../api/engine_exception.dart';
import '../repositories/game_repository.dart';
import 'json_equals.dart';
import 'local_game.dart';
import 'local_game_storage.dart';
import 'local_kernel.dart';

/// The most transitions one append carries. The route accepts 200, and a long
/// game syncs as several batches rather than one body the server would refuse.
const localSyncBatchSize = 200;

/// How one game's synchronization ended.
enum LocalSyncOutcome {
  /// Nothing to do: the server already holds every committed version.
  upToDate,

  /// The server accepted everything this device had.
  synced,

  /// The server's rules refused a move this device accepted, or another device
  /// moved the game on. Local play stops and the server's copy is the truth.
  diverged,

  /// The server could not be reached. Nothing changed; the next attempt
  /// resumes from the same point.
  unreachable,

  /// The server refused the game itself: another account owns the id, or this
  /// build is newer than the deployment. Retrying changes nothing.
  refused,

  /// The server's copy is finished or aborted while this device thought the
  /// game was live, so the record adopted that terminal status.
  terminal,
}

/// What one [LocalGameSync.syncAll] pass did.
final class LocalSyncReport {
  const LocalSyncReport(this.outcomes);

  /// Every game considered, keyed by game id.
  final Map<String, LocalSyncOutcome> outcomes;

  /// Games whose whole log now sits on the server.
  int get synced => _count(LocalSyncOutcome.synced);

  /// Games the server and this device disagree about.
  int get diverged => _count(LocalSyncOutcome.diverged);

  /// Whether anything was left for a later pass, which is what makes a
  /// connectivity change worth acting on.
  bool get hasPending => _count(LocalSyncOutcome.unreachable) > 0;

  int _count(LocalSyncOutcome outcome) =>
      outcomes.values.where((value) => value == outcome).length;

  @override
  String toString() => 'LocalSyncReport($outcomes)';
}

/// Carries a device's local games to the server, where they become ordinary
/// games (decision 0012).
///
/// Append-only replay, never an upload of results: the create route starts the
/// authoritative object from this device's seed and the append route replays
/// the device's moves through the authoritative TypeScript rules, so the
/// server's copy is produced by the same rules every online game uses. What the
/// player saw and what the server records can therefore only differ if the two
/// rule halves disagree, and that difference is reported rather than resolved.
///
/// Nothing here throws for a transport failure. Synchronization runs in the
/// background behind live play, so an unreachable server is an ordinary state
/// to be in, not an error to surface: the record keeps its own progress marker
/// and the next pass resumes from it.
final class LocalGameSync {
  /// Carries [userId]'s local games. One instance per signed-in user: the
  /// games it walks are that user's, and a sign-out replaces it.
  factory LocalGameSync({
    required LocalGameStorage storage,
    required GameRepository games,
    required String userId,
  }) => LocalGameSync._(storage, games, userId);

  // Positional and private so the fields can stay private: Dart has no private
  // named parameter, so an initializing formal needs this shape.
  LocalGameSync._(this._storage, this._games, this._userId);

  final LocalGameStorage _storage;
  final GameRepository _games;
  final String _userId;

  /// The pass in flight, so a trigger arriving mid-pass joins it rather than
  /// starting a second one against the same games.
  Future<LocalSyncReport>? _inFlight;

  /// Carries every unsynchronized game this user holds.
  ///
  /// Single-flight: a call made while a pass is running awaits that pass.
  Future<LocalSyncReport> syncAll() {
    final running = _inFlight;
    if (running != null) return running;
    final pass = _syncAll();
    _inFlight = pass;
    return pass.whenComplete(() {
      _inFlight = null;
    });
  }

  Future<LocalSyncReport> _syncAll() async {
    final outcomes = <String, LocalSyncOutcome>{};
    for (final game in await _storage.unsynced(_userId)) {
      outcomes[game.id] = await _syncGame(game);
    }
    return LocalSyncReport(outcomes);
  }

  /// Carries one game, by id. Answers [LocalSyncOutcome.upToDate] for a game
  /// this device does not decide, since there is then nothing to carry.
  Future<LocalSyncOutcome> syncGame(String id) async {
    final game = await _storage.load(accountId: _userId, gameId: id);
    if (game == null || !game.needsSync) return LocalSyncOutcome.upToDate;
    return _syncGame(game);
  }

  Future<LocalSyncOutcome> _syncGame(LocalGame game) async {
    var current = game;
    if (!current.remoteCreated) {
      final created = await _create(current);
      if (created.outcome != null) return created.outcome!;
      current = created.game;
    }
    return _append(current);
  }

  /// Creates and starts the server's copy, then records how far that copy
  /// already is.
  ///
  /// A session answering above version 0 means another device created this game
  /// and has been appending to it; adopting its version is what makes a second
  /// device continue rather than replay.
  Future<({LocalGame game, LocalSyncOutcome? outcome})> _create(
    LocalGame game,
  ) async {
    try {
      final started = await _games.createLocalGame(
        gameId: game.id,
        schemaVersion: game.schemaVersion,
        config: game.config,
        seed: game.seed,
        botIds: [
          for (final seat in game.roster)
            if (seat.botId != null) seat.botId!,
        ],
        createdAt: game.createdAt,
        minPlayers: game.roster.length,
        maxPlayers: game.roster.length,
      );
      final marked = await _mark(
        game,
        remoteCreated: true,
        syncedVersion: started.session.version ?? 0,
      );
      return (game: marked, outcome: null);
    } on EngineException {
      // The server decided. `notCreator` means this id belongs to another
      // account and `serverUpdateRequired` that the deployment is behind this
      // build: neither changes by being asked again.
      return (game: game, outcome: LocalSyncOutcome.refused);
    } on Object {
      return (game: game, outcome: LocalSyncOutcome.unreachable);
    }
  }

  Future<LocalSyncOutcome> _append(LocalGame game) async {
    var current = game;
    var retriedStale = false;
    while (current.syncedVersion < (current.version ?? 0)) {
      final batch = await _batch(current);
      if (batch.isEmpty) {
        // Unsynchronized versions the wire cannot carry. Nothing retries its
        // way out of that, and reporting success here would leave the two
        // copies permanently apart while every later pass said they agreed.
        await _mark(current, diverged: true);
        return LocalSyncOutcome.diverged;
      }
      final LocalTransitionsApplied applied;
      try {
        applied = await _games.appendLocalTransitions(
          gameId: current.id,
          fromVersion: current.syncedVersion,
          transitions: batch,
        );
      } on EngineException catch (error) {
        if (error.code != ErrorCode.stateUpdated || retriedStale) {
          return LocalSyncOutcome.refused;
        }
        // The server is not where this device believed. Read its session: a
        // version beyond ours means another device moved the game, which this
        // device's unsynchronized moves cannot be reconciled with.
        retriedStale = true;
        final resolved = await _resolveStale(current);
        if (resolved.outcome != null) return resolved.outcome!;
        current = resolved.game;
        continue;
      } on Object {
        return LocalSyncOutcome.unreachable;
      }

      current = await _mark(
        current,
        syncedVersion: current.syncedVersion + applied.applied,
      );
      // A batch the server took means this device's marker is right again, so
      // a later batch in the same long game gets its own chance to resolve a
      // stale marker rather than inheriting an earlier one's.
      retriedStale = false;
      if (applied.rejection != null) {
        await _mark(current, diverged: true);
        return LocalSyncOutcome.diverged;
      }
      if (_isTerminal(applied.session.status) && !current.isTerminal) {
        await _mark(current, status: applied.session.status);
        return LocalSyncOutcome.terminal;
      }
    }
    return LocalSyncOutcome.synced;
  }

  /// Reconciles a `stateUpdated` refusal against the server's own session.
  ///
  /// The refusal says only that this device's marker is wrong, and the server's
  /// version says why. Up to what this device has itself committed, the server
  /// is simply further along than the marker recorded, which is what a lost
  /// append response looks like: correct the marker and carry on from there,
  /// since a move the server already holds is one this device is not going to
  /// send twice. Beyond that, the server holds moves this device never made,
  /// so another device is playing the same game and this device's unsent moves
  /// can never be reconciled with it.
  Future<({LocalGame game, LocalSyncOutcome? outcome})> _resolveStale(
    LocalGame game,
  ) async {
    final Session session;
    try {
      session = await _games.getSession(game.id);
    } on EngineException {
      return (game: game, outcome: LocalSyncOutcome.refused);
    } on Object {
      return (game: game, outcome: LocalSyncOutcome.unreachable);
    }
    final serverVersion = session.version ?? 0;
    if (serverVersion > (game.version ?? 0)) {
      await _mark(game, diverged: true);
      return (game: game, outcome: LocalSyncOutcome.diverged);
    }
    // Versions alone cannot tell the two cases apart. A server sitting at
    // exactly this device's version is either the lost-response case, where it
    // holds this device's own moves, or another device that played the same
    // number of different moves. Only the state decides, so compare the one the
    // server actually holds at its own version with the one this device
    // committed there.
    final ours = await _storage.stateAt(
      accountId: _userId,
      gameId: game.id,
      version: serverVersion,
    );
    if (ours == null) {
      await _mark(game, diverged: true);
      return (game: game, outcome: LocalSyncOutcome.diverged);
    }
    final LocalRecord theirs;
    try {
      theirs = await _games.getLocalRecord(
        game.id,
        from: serverVersion,
        to: serverVersion,
      );
    } on EngineException {
      return (game: game, outcome: LocalSyncOutcome.refused);
    } on Object {
      return (game: game, outcome: LocalSyncOutcome.unreachable);
    }
    final theirState = theirs.transitions
        .where((row) => row.version == serverVersion)
        .map((row) => (row.state as Map).cast<String, dynamic>())
        .firstOrNull;
    if (theirState == null || !jsonEquals(theirState, ours)) {
      await _mark(game, diverged: true);
      return (game: game, outcome: LocalSyncOutcome.diverged);
    }
    if (_isTerminal(session.status) && !game.isTerminal) {
      await _mark(game, status: session.status);
      return (game: game, outcome: LocalSyncOutcome.terminal);
    }
    return (
      game: await _mark(game, syncedVersion: serverVersion),
      outcome: null,
    );
  }

  /// The next page of unsynchronized transitions, on the wire.
  ///
  /// Version 0 is never sent: the create route started the server's object from
  /// the same seed, so its own `initialState` produced that version.
  Future<List<LocalTransition>> _batch(LocalGame game) async {
    final logged = await _storage.transitionsAfter(
      accountId: _userId,
      gameId: game.id,
      afterVersion: game.syncedVersion,
      limit: localSyncBatchSize,
    );
    final batch = <LocalTransition>[];
    for (final transition in logged) {
      final wire = _wireTransition(transition);
      if (wire == null) break;
      batch.add(wire);
    }
    return batch;
  }

  /// One logged transition as the import route's shape, or null for one the
  /// route cannot carry (the start transition, or an engine-owned entry a local
  /// game never produces).
  LocalTransition? _wireTransition(LocalGameTransition transition) {
    final action = transition.action;
    if (action == null) return null;
    final seat = action.playerIndex;
    if (seat == null) return null;
    return LocalTransition(
      seat: seat,
      kind: switch (action.kind) {
        LocalActionKind.game => LocalTransitionKindEnum.game,
        LocalActionKind.lifecycle => LocalTransitionKindEnum.lifecycle,
      },
      data: action.data,
    );
  }

  bool _isTerminal(GameStatus status) =>
      status == GameStatus.finished || status == GameStatus.aborted;

  /// Records this pass's own fields, and only those: the storage updates them in
  /// place, so a move the engine commits while this pass runs is never
  /// overwritten by the snapshot the pass started from.
  Future<LocalGame> _mark(
    LocalGame game, {
    bool? remoteCreated,
    int? syncedVersion,
    bool? diverged,
    GameStatus? status,
  }) => _storage.mark(
    accountId: _userId,
    gameId: game.id,
    remoteCreated: remoteCreated,
    syncedVersion: syncedVersion,
    diverged: diverged,
    status: status,
  );
}
