import 'dart:async';

import 'package:dio/dio.dart';
import 'package:eigen_api/eigen_api.dart';

import '../api/engine_call.dart';
import '../api/game_socket.dart';
import '../api/games_page.dart';
import '../domain/operation_identity.dart';
import '../domain/game_session.dart';

/// Number of games fetched per lobby page.
const lobbyPageSize = 50;

/// Number of games shown in the replay list on a player's profile.
const profileGamesPageSize = 10;

void _validateGapFrames(
  List<Frame> frames, {
  required int from,
  required int to,
}) {
  final expectedCount = to - from + 1;
  if (frames.length != expectedCount) {
    throw StateError(
      'Incomplete frame gap: expected $expectedCount frames for $from..$to, '
      'received ${frames.length}',
    );
  }
  for (var offset = 0; offset < frames.length; offset++) {
    final expectedVersion = from + offset;
    if (frames[offset].version != expectedVersion) {
      throw StateError(
        'Invalid frame gap: expected version $expectedVersion, '
        'received ${frames[offset].version}',
      );
    }
  }
}

/// Everything a client does to a game: discovery, the waiting room, moves, and
/// the live frame feed.
///
/// Commands all travel over HTTP even while a socket is open - the socket is a
/// one-way feed. That is what makes a command's outcome unambiguous: it is the
/// HTTP status, not something to correlate against a later broadcast.
class GameRepository {
  GameRepository(Dio http, this._socket)
    : _api = GamesApi(http),
      _bots = BotsApi(http),
      _players = PlayersApi(http);

  final GamesApi _api;
  final BotsApi _bots;
  final PlayersApi _players;
  final GameSocket _socket;
  final _sessionListeners = <String, Set<void Function(Session)>>{};

  /// Every authoritative HTTP snapshot enters the same pipeline as the socket.
  /// Listeners exist only while a session stream is subscribed.
  Session _receive(Session session) {
    for (final listener in _sessionListeners[session.gameId] ?? {}) {
      listener(session);
    }
    return session;
  }

  Future<T> _receiveBody<T>(
    Future<T> response,
    Session Function(T) session,
  ) async {
    final body = await response;
    _receive(session(body));
    return body;
  }

  // ── Discovery ──────────────────────────────────────────────────────────────

  /// Public games waiting for players, newest first.
  ///
  /// [cursor] is the previous page's [GamesPage.nextCursor]; omit it for the
  /// first page. Paging by cursor rather than offset keeps a page stable while
  /// the lobby churns underneath the reader - with an offset, one new game
  /// shifts every subsequent page by one and a scroll shows the same row twice.
  Future<GamesPage> getLobby({
    int limit = lobbyPageSize,
    String? cursor,
  }) async {
    final body = await engineData(
      () => _api.getLobby(limit: limit, cursor: cursor),
    );
    return (games: body.games.toList(), nextCursor: body.nextCursor);
  }

  /// One game's index entry: what discovery and history show.
  ///
  /// This is the D1 read-model, which is a mirror of the game's own session and
  /// can lag it. It backs lists and cards. A screen bound to one game reads
  /// [getSession] or the live stream instead, never this.
  Future<GameSummary> getGame(String gameId) async {
    return engineData(() => _api.getGame(gameId: gameId));
  }

  /// One game's current session, from the game itself rather than the index.
  ///
  /// The socket delivers the same value and keeps delivering it, so a screen
  /// with a socket never needs this. It serves the paths without one: a
  /// deep-link preview, and a replay of a finished game.
  Future<Session> getSession(String gameId) async {
    return _receive(
      await engineData(() => _api.getGameSession(gameId: gameId)),
    );
  }

  /// A player's finished public games - the replay list on their profile.
  ///
  /// Any player, human or bot. Public and finished only, so this exposes
  /// nothing that was not already replayable by anyone holding the game's id.
  Future<GamesPage> getPlayerGames(
    String playerId, {
    int? limit,
    String? cursor,
  }) async {
    final body = await engineData(
      () => _players.getPlayerGames(
        playerId: playerId,
        limit: limit,
        cursor: cursor,
      ),
    );
    return (games: body.games.toList(), nextCursor: body.nextCursor);
  }

  /// The bots available to seat, for this build's schema version.
  Future<List<Bot>> getBots() async {
    final body = await engineData(() => _bots.getBots());
    return body.bots;
  }

  // ── Creating and joining ───────────────────────────────────────────────────

  /// Creates a game and returns its id and shareable short code.
  ///
  /// [creationId] identifies this one creation attempt. Generate it with
  /// [newGameCreationId] and reuse it after an ambiguous transport failure;
  /// use a new value for a deliberate second game.
  ///
  /// [rated] is a concrete assertion, not a preference: the caller computes it
  /// from the rules twin and the server validates it rather than coercing, so a
  /// disagreement is a loud 422 instead of a silently unrated game.
  Future<Created> createGame({
    required String creationId,
    required GameAccess access,
    required int schemaVersion,
    required Object config,
    required int minPlayers,
    required int maxPlayers,
    bool? rated,
    int? turnSeconds,
    int? budgetSeconds,
    int? incrementSeconds,
  }) async {
    return engineData(
      () => _api.createGame(
        createGame: CreateGame(
          creationId: creationId,
          access: access,
          schemaVersion: schemaVersion,
          config: config,
          minPlayers: minPlayers,
          maxPlayers: maxPlayers,
          rated: rated,
          turnSeconds: turnSeconds,
          budgetSeconds: budgetSeconds,
          incrementSeconds: incrementSeconds,
        ),
      ),
    );
  }

  /// Creates a private game seated with the caller plus [botIds] and starts it,
  /// in one call.
  ///
  /// [creationId] follows the same retry contract as [createGame].
  ///
  /// Answers with the caller's session at version 0: the game is already running
  /// before any socket exists, so this response is the only place its opening
  /// frame can come from.
  Future<SoloStarted> createSoloGame({
    required String creationId,
    required int schemaVersion,
    required Object config,
    required int minPlayers,
    required int maxPlayers,
    required List<String> botIds,
    bool? rated,
    int? turnSeconds,
    int? budgetSeconds,
    int? incrementSeconds,
  }) async {
    return _receiveBody(
      engineData(
        () => _api.createSoloGame(
          createSolo: CreateSolo(
            creationId: creationId,
            schemaVersion: schemaVersion,
            config: config,
            minPlayers: minPlayers,
            maxPlayers: maxPlayers,
            botIds: botIds,
            rated: rated,
            turnSeconds: turnSeconds,
            budgetSeconds: budgetSeconds,
            incrementSeconds: incrementSeconds,
          ),
        ),
      ),
      (body) => body.session,
    );
  }

  /// Takes a seat. [clientSchemaVersion] is the newest version this build
  /// ships. Published versions are retained contiguously, so the server accepts
  /// a game at any version less than or equal to it.
  ///
  /// Answers with the same session [joinGameByCode] does: they are one operation
  /// differing only in how the game was named, so a caller handles either result
  /// identically.
  Future<Session> joinGame(
    String gameId, {
    required int clientSchemaVersion,
  }) async {
    final body = await engineData(
      () => _api.joinGame(
        gameId: gameId,
        join: Join(clientSchemaVersion: clientSchemaVersion),
      ),
    );
    return _receive(body.session);
  }

  /// Takes a seat using a shared short code rather than a game id.
  ///
  /// The session carries the game's id, which the by-code caller never had: this
  /// is the only place they learn which game they are now in.
  Future<Session> joinGameByCode(
    String shortCode, {
    required int clientSchemaVersion,
  }) async {
    final body = await engineData(
      () => _api.joinGameByCode(
        joinByCode: JoinByCode(
          shortCode: shortCode,
          clientSchemaVersion: clientSchemaVersion,
        ),
      ),
    );
    return _receive(body.session);
  }

  /// Gives up a seat before the game starts. The creator cancels instead.
  Future<Session> leaveGame(String gameId) async {
    final body = await engineData(() => _api.leaveGame(gameId: gameId));
    return _receive(body.session);
  }

  /// Abandons a game that has not started. Creator only.
  Future<Session> cancelGame(String gameId) async {
    final body = await engineData(() => _api.cancelGame(gameId: gameId));
    return _receive(body.session);
  }

  /// Seats a bot alongside the humans. Creator only, pre-start.
  Future<Session> addBot(String gameId, {required String botId}) async {
    final body = await engineData(
      () => _api.addBot(
        gameId: gameId,
        addBot: AddBot(botId: botId),
      ),
    );
    return _receive(body.session);
  }

  /// Starts a ready game. Creator only.
  ///
  /// Answers with the caller's own session at version 0; every other seat gets
  /// the same transition over its own socket, since a start has no single acting
  /// seat.
  Future<Session> startGame(String gameId) async {
    final body = await engineData(() => _api.startGame(gameId: gameId));
    return _receive(body.session);
  }

  // ── Importing a game played on the device ──────────────────────────────────

  /// Creates and starts the server's copy of a game this device played offline.
  ///
  /// The server adopts [gameId] and [seed] verbatim, so its own `initialState`
  /// draws exactly what the device drew and its version 0 is the same board.
  /// Idempotent on [gameId]: a retry after an ambiguous failure answers with the
  /// game it already made rather than a second one, which is what lets the
  /// caller retry a lost response with no bookkeeping.
  Future<SoloStarted> createLocalGame({
    required String gameId,
    required int schemaVersion,
    required Object config,
    required String seed,
    required List<String> botIds,
    required DateTime createdAt,
    int? minPlayers,
    int? maxPlayers,
  }) async {
    final body = await engineData(
      () => _api.createLocalGame(
        createLocalGame: CreateLocalGame(
          gameId: gameId,
          schemaVersion: schemaVersion,
          config: config,
          seed: seed,
          botIds: botIds,
          createdAt: createdAt.toUtc().millisecondsSinceEpoch,
          minPlayers: minPlayers,
          maxPlayers: maxPlayers,
        ),
      ),
    );
    return SoloStarted(session: _receive(body.session));
  }

  /// Appends the device's transitions after [fromVersion], replaying them
  /// through the authoritative rules.
  ///
  /// The answer counts what actually committed, so a caller advances its own
  /// synchronization point by [LocalTransitionsApplied.applied] rather than by
  /// what it sent. A non-null [LocalTransitionsApplied.rejection] means the
  /// server's rules refused a move this device accepted: the two halves have
  /// diverged, which is a defect to surface, never something to retry.
  Future<LocalTransitionsApplied> appendLocalTransitions({
    required String gameId,
    required int fromVersion,
    required List<LocalTransition> transitions,
  }) {
    return _receiveBody(
      engineData(
        () => _api.appendLocalTransitions(
          gameId: gameId,
          localTransitions: LocalTransitions(
            fromVersion: fromVersion,
            transitions: transitions,
          ),
        ),
      ),
      (body) => body.session,
    );
  }

  /// The server's whole copy of a local game: its session, its seed, and every
  /// transition with the raw state it committed.
  ///
  /// The one route that returns raw state and the seed, and it is sound because
  /// the caller is the game's only human and already held both on the device
  /// that played it. This is what lets a second device continue a game the
  /// first one started.
  Future<LocalRecord> getLocalRecord(String gameId, {int from = 0, int? to}) {
    return _receiveBody(
      engineData(() => _api.getLocalRecord(gameId: gameId, from: from, to: to)),
      (body) => body.session,
    );
  }

  /// The whole record, in as many pages as it takes.
  ///
  /// [getLocalRecord] answers a bounded page — the route caps one response at
  /// 1000 transitions — so a long game needs several calls. Resuming on a
  /// second device must have every version, because the engine replays the log
  /// from 0, and a truncated pull that still carried the session's true version
  /// would look complete while silently dropping the end of the game.
  ///
  /// The last page's session is the one returned: it is the freshest read of a
  /// game that nothing else should be moving, and using the first page's would
  /// describe the record as older than its own transitions.
  Future<LocalRecord> getWholeLocalRecord(String gameId) async {
    var page = await getLocalRecord(gameId);
    if (page.transitions.isEmpty) return page;
    final transitions = [...page.transitions];
    while (transitions.last.version < (page.session.version ?? 0)) {
      final next = await getLocalRecord(
        gameId,
        from: transitions.last.version + 1,
      );
      // A page that carries nothing new would loop forever. The server is the
      // only thing that could produce one, and it means the log stops short of
      // the version its own session reports, so stop and let the import's
      // completeness check name it.
      if (next.transitions.isEmpty) break;
      transitions.addAll(next.transitions);
      page = next;
    }
    return LocalRecord(
      session: page.session,
      seed: page.seed,
      createdAt: page.createdAt,
      finishedAt: page.finishedAt,
      transitions: transitions,
    );
  }

  // ── Playing ────────────────────────────────────────────────────────────────

  /// Submits a move for [seat] against [expectedVersion].
  ///
  /// [seat] is the caller's own index, verified against the roster server-side.
  /// [expectedVersion] is the optimistic lock: if the board moved on in a way
  /// this seat could see, the move is refused with [ErrorCode.stateUpdated]
  /// rather than applied to a state the player never saw.
  ///
  /// The returned session is this seat's own committed view. It automatically
  /// enters [sessions] so the move renders without waiting on the socket.
  Future<CommandAccepted> submitAction({
    required String gameId,
    required int seat,
    required int expectedVersion,
    required Object? data,
  }) async {
    return _receiveBody(
      engineData(
        () => _api.submitAction(
          gameId: gameId,
          action: Action(
            seat: seat,
            data: data,
            expectedVersion: expectedVersion,
          ),
        ),
      ),
      (body) => body.session,
    );
  }

  /// Resigns [seat] from a live game.
  Future<CommandAccepted> forfeitGame({
    required String gameId,
    required int seat,
  }) async {
    return _receiveBody(
      engineData(
        () => _api.forfeitGame(
          gameId: gameId,
          forfeit: Forfeit(seat: seat),
        ),
      ),
      (body) => body.session,
    );
  }

  /// Frames in `[from, to]` for the caller's seat, version-ascending.
  ///
  /// Backs both gap recovery and replay. A non-participant may read a finished
  /// public game, which is what makes spectating a replay possible.
  Future<List<Frame>> getFrames(String gameId, {int from = 0, int? to}) async {
    final body = await engineData(
      () => _api.getFrames(gameId: gameId, from: from, to: to),
    );
    return body.frames;
  }

  // ── The live feed ──────────────────────────────────────────────────────────

  /// The game's live session: one complete value per change, in order, with any
  /// missed frames played through first.
  ///
  /// Every snapshot states the whole truth for this seat, so a client that holds
  /// the newest one is correct however many it missed. That is what makes this
  /// recoverable without reconstruction: staleness is one `seq` comparison, and
  /// a socket drop needs no special handling because the reconnect's first
  /// message is the current snapshot.
  ///
  /// Two things are still worth work here, and they are the only two.
  ///
  /// **Gaps animate.** Frames are append-only server-side, one per seat per
  /// version, so a version jump means the client missed transitions it would
  /// rather show than skip. The missing span is fetched and emitted first, one
  /// session at a time, each carrying the *previous* envelope so the status
  /// cannot run ahead of the moves. Then the real snapshot lands and supplies
  /// the envelope. A cold open does not animate: with no predecessor rendered
  /// there is nothing to animate from, so it snaps to the present.
  ///
  /// **Duplicates are dropped.** All HTTP methods returning a session publish
  /// it here automatically. HTTP and socket snapshots share the same queue;
  /// whichever copy arrives second is discarded by `seq`. Callers never need
  /// to forward command responses or wait for a broadcast to render a move.
  Stream<GameSession> sessions(String gameId) {
    late StreamController<GameSession> controller;
    GameSession? held;
    var connectionFailed = false;
    StreamSubscription<Session>? socketSub;
    var cancelled = false;

    // Serialises handling so emissions stay in order however bursts of
    // snapshots interleave with the async gap fetches they trigger.
    var pipeline = Future<void>.value();

    void emit(GameSession session) {
      held = session;
      controller.add(session);
    }

    /// Play through the frames between what is held and [next], then apply it.
    ///
    /// Only a game that is already under way can have a gap: the client must
    /// have rendered a version to be behind one.
    Future<void> apply(Session next) async {
      if (cancelled) return;
      final current = held;
      if (current == null) {
        emit(GameSession(snapshot: next, frame: next.frame));
        return;
      }
      if (!current.supersededBy(next)) {
        // A reconnect may restate the same revision. Clear the visible error
        // without replaying a move or relaxing snapshot ordering.
        if (connectionFailed && next.seq == current.snapshot.seq) {
          connectionFailed = false;
          emit(current);
        }
        return;
      }
      connectionFailed = false;

      final from = current.version;
      final to = next.version;
      if (from != null && to != null && to > from + 1) {
        final gapFrom = from + 1;
        final gapTo = to - 1;
        final gaps = await getFrames(gameId, from: gapFrom, to: gapTo);
        _validateGapFrames(gaps, from: gapFrom, to: gapTo);
        for (final gap in gaps) {
          if (cancelled) return;
          final latest = held;
          if (latest == null || gap.version <= (latest.version ?? -1)) continue;
          emit(latest.applyGapFrame(gap));
        }
      }
      if (cancelled) return;
      final latest = held;
      if (latest != null) emit(latest.applySnapshot(next));
    }

    void enqueue(Session next) {
      pipeline = pipeline.then((_) => apply(next)).catchError((Object error) {
        if (!cancelled) controller.addError(error);
      });
    }

    void socketError(Object error, StackTrace stack) {
      pipeline = pipeline.then((_) {
        if (cancelled) return;
        connectionFailed = true;
        controller.addError(error, stack);
      });
    }

    controller = StreamController<GameSession>(
      onListen: () {
        (_sessionListeners[gameId] ??= {}).add(enqueue);
        socketSub = _socket
            .connect(gameId)
            .listen(enqueue, onError: socketError);
      },
      onCancel: () async {
        cancelled = true;
        final listeners = _sessionListeners[gameId];
        listeners?.remove(enqueue);
        if (listeners?.isEmpty ?? false) _sessionListeners.remove(gameId);
        await socketSub?.cancel();
      },
    );

    return controller.stream;
  }
}
