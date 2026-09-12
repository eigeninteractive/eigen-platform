import 'dart:async';
import 'dart:math';

import 'package:eigen_api/eigen_api.dart';

import '../api/engine_exception.dart';
import 'bot_runner.dart';
import 'local_game.dart';
import 'local_game_store.dart';
import 'local_kernel.dart';
import 'local_rules.dart';
import 'local_session.dart';

/// A bot's turn failed: its brain threw, answered with a move the rules
/// refused, or has no registry row on this device.
///
/// Reported on [LocalGameEngine.sessions]' error channel rather than swallowed.
/// A server game has a deadline behind a broken bot and times the seat out; a
/// local game is untimed, so nothing would ever move it again and the player
/// would sit in front of a board that silently stopped. The seat stays pending,
/// so the game is resumable once the build ships a fixed brain.
final class LocalBotFailed implements Exception {
  const LocalBotFailed({
    required this.gameId,
    required this.seat,
    required this.botId,
    required this.cause,
  });

  final String gameId;
  final int seat;

  /// The bot registry row seated there, or null when the roster names one this
  /// device's catalog no longer holds.
  final String? botId;

  /// What went wrong: the brain's own throw, or the kernel's rejection
  /// rendered as an [EngineException].
  final Object cause;

  @override
  String toString() =>
      'LocalBotFailed(game $gameId, seat $seat, bot $botId): $cause';
}

/// The device's Durable Object: one serialized command queue over one local
/// game (decision 0012).
///
/// It holds what the object holds — meta, roster, the append-only transition
/// log, per-seat frames — and advances it through [localCommit], the same
/// pipeline in the same order the server runs. A human action commits, then
/// every newly pending bot seat runs its brain and commits in the same queue
/// until a human is pending or the game ends. Every commit persists, and every
/// commit emits the [Session] snapshot the socket would have pushed, with
/// [Session.seq] advancing per commit, so a game screen consumes a local game
/// through the existing session path with no game code change.
///
/// Pure Dart, like everything else here: the store, the bot runner and the
/// clock are ports, so the Flutter adapter supplies Drift, an isolate, and the
/// real clock above it.
final class LocalGameEngine {
  /// Opens an engine over an existing record: a game resumed from the store, or
  /// one pulled back from the server on another device.
  factory LocalGameEngine({
    required LocalGameRecord record,
    required AnyLocalGameRules rules,
    required LocalGameStore store,
    required Map<String, Bot> bots,
    BotRunner botRunner = const InlineBotRunner(),
    DateTime Function() clock = DateTime.now,
  }) => LocalGameEngine._(record, rules, store, bots, botRunner, clock);

  // Private and positional so the fields can stay private: a named parameter
  // cannot be an initializing formal for one.
  LocalGameEngine._(
    this._record,
    this._rules,
    this._store,
    this._bots,
    this._botRunner,
    this._clock,
  ) {
    _current = localSession(_record, playerIndex: _viewerSeat);
  }

  /// Creates, starts and persists a fresh local game, then returns the engine
  /// driving it.
  ///
  /// No network is involved: the device mints the id and the 128-bit seed, runs
  /// [LocalGameRules.initialState] through the local kernel, and writes the
  /// record. Seat 0 is [userId]; [botIds] fill the rest of the roster in order.
  /// [newGameId] and [newSeed] exist so a test can pin identity; production
  /// uses `Random.secure()` through their defaults.
  static Future<LocalGameEngine> create({
    required String userId,
    required int schemaVersion,
    required Map<String, dynamic> config,
    required List<String> botIds,
    required Map<String, Bot> bots,
    required AnyLocalGameRules rules,
    required LocalGameStore store,
    BotRunner botRunner = const InlineBotRunner(),
    DateTime Function() clock = DateTime.now,
    String Function()? newGameId,
    String Function()? newSeed,
    Random? random,
  }) async {
    final record = LocalGameRecord(
      id: (newGameId ?? () => newLocalGameId(random))(),
      createdBy: userId,
      createdAt: clock(),
      schemaVersion: schemaVersion,
      config: config,
      seed: (newSeed ?? () => newLocalSeed(random))(),
      roster: [
        LocalSeat(
          playerIndex: 0,
          userId: userId,
          botId: null,
          type: SeatTypeEnum.human,
        ),
        for (final (index, botId) in botIds.indexed)
          LocalSeat(
            playerIndex: index + 1,
            userId: null,
            botId: botId,
            type: SeatTypeEnum.bot,
          ),
      ],
      // `ready` for exactly as long as the start commit takes: the kernel's
      // start guard is the server's, and a local game is full the moment it
      // exists.
      status: GameStatus.ready,
      seq: 0,
      transitions: const [],
      frames: const {},
    );
    final engine = LocalGameEngine(
      record: record,
      rules: rules,
      store: store,
      bots: bots,
      botRunner: botRunner,
      clock: clock,
    );
    await engine._enqueue(() => engine._commit(LocalStartIntent(record.seed)));
    engine._enqueueBots();
    return engine;
  }

  final AnyLocalGameRules _rules;
  final LocalGameStore _store;
  final Map<String, Bot> _bots;
  final BotRunner _botRunner;
  final DateTime Function() _clock;
  final StreamController<Session> _controller =
      StreamController<Session>.broadcast();

  LocalGameRecord _record;
  late Session _current;

  /// Serializes every command, exactly like the Durable Object's input gate:
  /// a human move, the bot chase it starts, and a resign can only interleave at
  /// a commit boundary.
  Future<void> _queue = Future<void>.value();

  /// The record as it stands. The store holds the same value.
  LocalGameRecord get record => _record;

  /// The newest snapshot, for the seat the signed-in human holds. Always
  /// current, including for commits made before anyone listened.
  Session get current => _current;

  /// Every snapshot this engine states, in commit order.
  ///
  /// The same value the socket delivers for a server game, so the caller folds
  /// it into a `GameSession` the same way. A local game never has a frame gap
  /// to recover: every version is committed here, in order, by this queue.
  /// [LocalBotFailed] arrives on the error channel.
  Stream<Session> get sessions => _controller.stream;

  int get _viewerSeat => _record.humanSeat ?? 0;

  /// Submits [data] for [seat] against [expectedVersion].
  ///
  /// Mirrors the server command: the accepted result carries this seat's own
  /// committed session, and a refusal throws [EngineException] carrying the
  /// matching [ErrorCode], so the Flutter error path renders a local rejection
  /// exactly as it renders the server's.
  Future<CommandAccepted> submitAction({
    required int seat,
    required Map<String, dynamic> data,
    required int expectedVersion,
  }) {
    final accepted = _enqueue(
      () => _commit(
        LocalActionIntent(
          seat: seat,
          expectedVersion: expectedVersion,
          data: data,
          actor: LocalActor.user,
        ),
      ),
    );
    _enqueueBots();
    return accepted;
  }

  /// Resigns [seat]. Unconditional, like the server's forfeit: no version or
  /// pending guard, and the game's own `applyLifecycle` decides what it means.
  Future<CommandAccepted> forfeit({required int seat}) {
    final accepted = _enqueue(() => _commit(LocalForfeitIntent(seat)));
    _enqueueBots();
    return accepted;
  }

  /// Stops emitting. The record stays in the store, so reopening the game
  /// builds a fresh engine over it.
  Future<void> close() async {
    await _queue;
    await _controller.close();
  }

  Future<T> _enqueue<T>(Future<T> Function() action) {
    final completer = Completer<T>();
    _queue = _queue.then((_) async {
      try {
        completer.complete(await action());
      } on Object catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    });
    return completer.future;
  }

  /// Chases the bots behind whatever the caller just committed. Deliberately
  /// not awaited by the caller: a human's move resolves as soon as it commits,
  /// and the bots' moves arrive on [sessions] as they land.
  void _enqueueBots() {
    unawaited(
      _enqueue(_driveBots).catchError((Object error) {
        // A failed bot turn is already reported through `_reportBotFailure`,
        // so this only catches something escaping the chase itself. Reported
        // rather than dropped: an unhandled error in a detached queue slot
        // would otherwise take the isolate down.
        if (!_controller.isClosed) _controller.addError(error);
      }),
    );
  }

  /// Applies one intent, persists the record, and states the new session.
  Future<CommandAccepted> _commit(LocalIntent intent) async {
    final result = localCommit(
      game: _record.meta,
      state: _record.stateRow,
      roster: _record.roster,
      intent: intent,
      rules: _rules,
    );
    switch (result) {
      case LocalRejected(:final code, :final message):
        throw EngineException(message, code: code.errorCode);
      case LocalCommitPlan():
        // Persist before the engine moves, not after. A store that throws here
        // would otherwise leave `_record` a version ahead of `_current` and of
        // every listener, and since the next move is submitted against the
        // version the screen is showing, the kernel would refuse it as stale
        // from then on. Failing with the record untouched leaves the move
        // simply not made, which the caller can retry.
        final next = _applyPlan(result);
        await _store.save(next);
        _record = next;
        _current = localSession(_record, playerIndex: _viewerSeat);
        if (!_controller.isClosed) _controller.add(_current);
        return CommandAccepted(session: _current);
    }
  }

  LocalGameRecord _applyPlan(LocalCommitPlan plan) {
    final finished = plan.outcomes != null;
    return _record.copyWith(
      status: finished ? GameStatus.finished : GameStatus.active,
      seq: _record.seq + 1,
      transitions: [
        ..._record.transitions,
        LocalGameTransition(
          version: plan.nextState.version,
          state: plan.nextState.state,
          action: plan.action,
          pending: plan.nextState.pending,
        ),
      ],
      frames: {..._record.frames, plan.nextState.version: plan.frames},
      outcomes: plan.outcomes,
      finishedAt: finished ? _clock() : null,
    );
  }

  /// Runs every pending bot seat in turn until a human is pending or the game
  /// ends: the local stand-in for the wake effects the server dispatches.
  Future<void> _driveBots() async {
    while (_record.status == GameStatus.active) {
      final seat = _nextBotSeat();
      if (seat == null) return;
      if (!await _playBot(seat)) return;
    }
  }

  /// The lowest pending seat a bot holds, or null when none is waiting.
  int? _nextBotSeat() {
    final pending = _record.latest?.pending ?? const <int>[];
    final seats = [
      for (final seat in _record.roster)
        if (seat.botId != null && pending.contains(seat.playerIndex))
          seat.playerIndex,
    ]..sort();
    return seats.isEmpty ? null : seats.first;
  }

  /// Thinks for one bot seat and commits its move. Answers false when the turn
  /// failed, which stops the chase and leaves the seat pending.
  Future<bool> _playBot(int seat) async {
    final version = _record.version;
    final member = _record.roster.firstWhere(
      (candidate) => candidate.playerIndex == seat,
    );
    final botId = member.botId;
    final bot = botId == null ? null : _bots[botId];
    final frame = version == null
        ? null
        : _record.frameFor(seat: seat, version: version);
    if (bot == null || frame == null || version == null) {
      _reportBotFailure(
        seat,
        botId,
        StateError(
          'Seat $seat has no local bot to run: the catalog holds no row for '
          '"$botId" or the seat has no frame at version $version',
        ),
      );
      return false;
    }

    try {
      final data = await _botRunner.run(
        LocalBotJob(
          rules: _rules,
          botUsername: bot.username,
          observation: frame.data,
          pendingPlayers: frame.pendingPlayers,
          botConfig: (bot.config as Map).cast<String, dynamic>(),
          playerIndex: seat,
          config: _record.config,
          seed: _record.seed,
          // The version the bot is acting FROM, which is also the one it
          // commits against. The Durable Object draws the same stream from the
          // state it is about to act on (`deriveRng(..., next.version)` beside
          // `expectedVersion: next.version`), so a brain seated on the server
          // and on the device chooses the same move at the same position.
          version: version,
        ),
      );
      await _commit(
        LocalActionIntent(
          seat: seat,
          expectedVersion: version,
          data: data,
          actor: LocalActor.bot,
        ),
      );
      return true;
    } on Object catch (error) {
      _reportBotFailure(seat, botId, error);
      return false;
    }
  }

  void _reportBotFailure(int seat, String? botId, Object cause) {
    if (_controller.isClosed) return;
    _controller.addError(
      LocalBotFailed(
        gameId: _record.id,
        seat: seat,
        botId: botId,
        cause: cause,
      ),
    );
  }
}
