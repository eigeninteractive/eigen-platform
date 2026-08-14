import 'dart:async';

import 'package:eigen_api/eigen_api.dart';
import 'package:eigen_flutter/core/api/command_id.dart';
import 'package:eigen_flutter/core/api/engine_call.dart';
import 'package:eigen_flutter/core/api/games_page.dart';
import 'package:eigen_flutter/core/api/game_socket.dart';
import 'package:eigen_flutter/core/game/game_session.dart';

/// Number of games fetched per lobby page.
const lobbyPageSize = 50;

/// Number of games fetched per history page.
const historyPageSize = 30;

/// Number of games shown in the replay list on a player's profile.
const profileGamesPageSize = 10;

/// Games still playable - the home screen's list.
///
/// A plain string because the server declares the bucket as a query enum, and
/// query parameters generate as strings rather than Dart enums.
const activeGamesBucket = 'active';

/// Games that have ended - the history list.
const finishedGamesBucket = 'finished';

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
  GameRepository(this._api, this._bots, this._players, this._socket);

  final GamesApi _api;
  final BotsApi _bots;
  final PlayersApi _players;
  final GameSocket _socket;

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

  /// The caller's games in one bucket: `active` (still playable) or `finished`
  /// (the history list).
  ///
  /// [cursor] is the previous page's [GamesPage.nextCursor]; omit it for the
  /// first page. How each bucket is ordered is the server's business and is not
  /// restated here.
  Future<GamesPage> getMyGames({
    String bucket = activeGamesBucket,
    int limit = historyPageSize,
    String? cursor,
  }) async {
    final body = await engineData(
      () => _api.getMyGames(bucket: bucket, limit: limit, cursor: cursor),
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
    return engineData(() => _api.getGameSession(gameId: gameId));
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
  /// [rated] is a concrete assertion, not a preference: the caller computes it
  /// from the rules twin and the server validates it rather than coercing, so a
  /// disagreement is a loud 422 instead of a silently unrated game.
  Future<Created> createGame({
    required GameAccess access,
    required int schemaVersion,
    required Object config,
    required int minPlayers,
    required int maxPlayers,
    bool? rated,
    int? turnSeconds,
    int? budgetSeconds,
    int? incrementSeconds,
    String? commandId,
  }) async {
    return engineData(
      () => _api.createGame(
        idempotencyKey: commandId ?? newCommandId(),
        createGame: CreateGame(
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
  /// Answers with the caller's session at version 0: the game is already running
  /// before any socket exists, so this response is the only place its opening
  /// frame can come from.
  Future<SoloStarted> createSoloGame({
    required int schemaVersion,
    required Object config,
    required int minPlayers,
    required int maxPlayers,
    required List<String> botIds,
    bool? rated,
    int? turnSeconds,
    int? budgetSeconds,
    int? incrementSeconds,
    String? commandId,
  }) async {
    return engineData(
      () => _api.createSoloGame(
        idempotencyKey: commandId ?? newCommandId(),
        createSolo: CreateSolo(
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
    );
  }

  /// Takes a seat. [clientSchemaVersion] is the newest version this build ships
  /// rules for - the server refuses rather than let an old build mis-parse a
  /// newer game.
  ///
  /// Answers with the same session [joinGameByCode] does: they are one operation
  /// differing only in how the game was named, so a caller handles either result
  /// identically.
  Future<Session> joinGame(
    String gameId, {
    required int clientSchemaVersion,
    String? commandId,
  }) async {
    final body = await engineData(
      () => _api.joinGame(
        gameId: gameId,
        idempotencyKey: commandId ?? newCommandId(),
        join: Join(clientSchemaVersion: clientSchemaVersion),
      ),
    );
    return body.session;
  }

  /// Takes a seat using a shared short code rather than a game id.
  ///
  /// The session carries the game's id, which the by-code caller never had: this
  /// is the only place they learn which game they are now in.
  Future<Session> joinGameByCode(
    String shortCode, {
    required int clientSchemaVersion,
    String? commandId,
  }) async {
    final body = await engineData(
      () => _api.joinGameByCode(
        idempotencyKey: commandId ?? newCommandId(),
        joinByCode: JoinByCode(
          shortCode: shortCode,
          clientSchemaVersion: clientSchemaVersion,
        ),
      ),
    );
    return body.session;
  }

  /// Gives up a seat before the game starts. The creator cancels instead.
  Future<Session> leaveGame(String gameId, {String? commandId}) async {
    final body = await engineData(
      () => _api.leaveGame(
        gameId: gameId,
        idempotencyKey: commandId ?? newCommandId(),
      ),
    );
    return body.session;
  }

  /// Abandons a game that has not started. Creator only.
  Future<Session> cancelGame(String gameId, {String? commandId}) async {
    final body = await engineData(
      () => _api.cancelGame(
        gameId: gameId,
        idempotencyKey: commandId ?? newCommandId(),
      ),
    );
    return body.session;
  }

  /// Seats a bot alongside the humans. Creator only, pre-start.
  Future<Session> addBot(
    String gameId, {
    required String botId,
    String? commandId,
  }) async {
    final body = await engineData(
      () => _api.addBot(
        gameId: gameId,
        idempotencyKey: commandId ?? newCommandId(),
        addBot: AddBot(botId: botId),
      ),
    );
    return body.session;
  }

  /// Starts a ready game. Creator only.
  ///
  /// Answers with the caller's own session at version 0; every other seat gets
  /// the same transition over its own socket, since a start has no single acting
  /// seat.
  Future<Session> startGame(String gameId, {String? commandId}) async {
    final body = await engineData(
      () => _api.startGame(
        gameId: gameId,
        idempotencyKey: commandId ?? newCommandId(),
      ),
    );
    return body.session;
  }

  // ── Playing ────────────────────────────────────────────────────────────────

  /// Submits a move for [seat] against [expectedVersion].
  ///
  /// [seat] is the caller's own index, verified against the roster server-side.
  /// [expectedVersion] is the optimistic lock: if the board moved on in a way
  /// this seat could see, the move is refused with [ErrorCode.stateUpdated]
  /// rather than applied to a state the player never saw.
  ///
  /// [commandId] identifies this move as one intent; it travels as the
  /// `Idempotency-Key` header. Pass the same one again and the server replays the
  /// committed result rather than applying the move twice; pass it with a
  /// different move and the request is refused. Omitted, each call is a new
  /// intent with a fresh id.
  ///
  /// The returned session is this seat's own committed view. Feed it to
  /// [sessions] so the move renders without waiting on the socket; see that
  /// method for why both paths carry it.
  Future<CommandAccepted> submitAction({
    required String gameId,
    required int seat,
    required int expectedVersion,
    required Object? data,
    String? commandId,
  }) async {
    return engineData(
      () => _api.submitAction(
        gameId: gameId,
        idempotencyKey: commandId ?? newCommandId(),
        action: Action(
          seat: seat,
          data: data,
          expectedVersion: expectedVersion,
        ),
      ),
    );
  }

  /// Resigns [seat] from a live game.
  Future<CommandAccepted> forfeitGame({
    required String gameId,
    required int seat,
    String? commandId,
  }) async {
    return engineData(
      () => _api.forfeitGame(
        gameId: gameId,
        idempotencyKey: commandId ?? newCommandId(),
        forfeit: Forfeit(seat: seat),
      ),
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
  /// **Duplicates are dropped.** A move's own snapshot rides the
  /// [submitAction] response *and* fans out over the socket; pass the response
  /// to [inject] and whichever copy arrives second is discarded by `seq`. On the
  /// socket-less paths (a freshly created solo game, a move made while the
  /// socket is mid-reconnect) the injected copy is the only one, which is why
  /// the response carries a full session at all.
  Stream<GameSession> sessions(String gameId, {Stream<Session>? inject}) {
    late StreamController<GameSession> controller;
    GameSession? held;
    StreamSubscription<Session>? socketSub;
    StreamSubscription<Session>? injectSub;

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
      if (controller.isClosed) return;
      final current = held;
      if (current == null) {
        emit(GameSession(snapshot: next, frame: next.frame));
        return;
      }
      if (!current.supersededBy(next)) return;

      final from = current.version;
      final to = next.version;
      if (from != null && to != null && to > from + 1) {
        final gapFrom = from + 1;
        final gapTo = to - 1;
        final gaps = await getFrames(gameId, from: gapFrom, to: gapTo);
        _validateGapFrames(gaps, from: gapFrom, to: gapTo);
        for (final gap in gaps) {
          if (controller.isClosed) return;
          final latest = held;
          if (latest == null || gap.version <= (latest.version ?? -1)) continue;
          emit(latest.applyGapFrame(gap));
        }
      }
      if (controller.isClosed) return;
      final latest = held;
      if (latest != null) emit(latest.applySnapshot(next));
    }

    void enqueue(Session next) {
      pipeline = pipeline.then((_) => apply(next)).catchError((Object error) {
        if (!controller.isClosed) controller.addError(error);
      });
    }

    controller = StreamController<GameSession>(
      onListen: () {
        socketSub = _socket
            .connect(gameId)
            .listen(enqueue, onError: controller.addError);
        injectSub = inject?.listen(enqueue, onError: controller.addError);
      },
      onCancel: () async {
        await socketSub?.cancel();
        await injectSub?.cancel();
      },
    );

    return controller.stream;
  }
}
