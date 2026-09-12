import 'package:eigen_api/eigen_api.dart';

import 'local_rules.dart';
import 'rng.dart';

/// Why the local kernel refused an intent: the twin of the kernel's
/// `RejectCode` in `server/packages/kernel/src/errors.ts`, minus the codes an
/// untimed single-device game cannot produce.
///
/// The names are the server's, so the same rejection reads the same in a local
/// record and in an imported one, and [errorCode] maps each onto the wire
/// vocabulary the Flutter error path already renders.
enum LocalRejectCode {
  /// The game is not in a status that accepts this intent.
  notActive,

  /// Start requested but the game is not ready.
  notReady,

  /// The acting seat is not in the pending set.
  notPending,

  /// `expectedVersion` is not the current version, so the move was decided
  /// against a board the player is no longer looking at.
  stateUpdated,

  /// The move payload failed this version unit's action codec.
  invalidPayload,

  /// `applyAction` refused the move.
  illegalMove,

  /// The intent lost a race and is a clean no-op, not an error.
  abstain,
}

/// The wire error code each rejection surfaces as, so a local rejection and a
/// server rejection reach the UI through one path.
extension LocalRejectCodeError on LocalRejectCode {
  ErrorCode get errorCode => switch (this) {
    LocalRejectCode.notActive => ErrorCode.notActive,
    LocalRejectCode.notReady => ErrorCode.notReady,
    LocalRejectCode.notPending => ErrorCode.notPending,
    LocalRejectCode.stateUpdated => ErrorCode.stateUpdated,
    LocalRejectCode.invalidPayload => ErrorCode.invalidPayload,
    LocalRejectCode.illegalMove => ErrorCode.illegalMove,
    // An abstain is the engine's own no-op, never shown to a player; if one
    // ever escapes to the UI, "the game moved on" is the honest phrasing.
    LocalRejectCode.abstain => ErrorCode.stateUpdated,
  };
}

/// The game's standing configuration: the twin of the kernel's `GameRow`, and
/// the local record's `meta`.
///
/// The timing fields are gone rather than nulled: a local game is untimed by
/// definition, so a deadline, a bank or an increment has nothing to mean here
/// (decision 0012).
final class LocalGameMeta {
  const LocalGameMeta({
    required this.status,
    required this.schemaVersion,
    required this.config,
    required this.createdBy,
  });

  final GameStatus status;
  final int schemaVersion;

  /// The stored creation config, parsed by the version unit before any hook
  /// sees it.
  final Map<String, dynamic> config;

  /// The user who created the game, and the only human in it.
  final String createdBy;
}

/// The latest committed transition: the twin of the kernel's `StateRow`,
/// without the clocks an untimed game has no use for.
final class LocalStateRow {
  const LocalStateRow({
    required this.version,
    required this.state,
    required this.pending,
    required this.rngSeed,
  });

  final int version;
  final Map<String, dynamic> state;
  final List<int> pending;

  /// The game's base seed, minted once and copied onto every later row, from
  /// which every transition's and every bot's stream derives.
  final String rngSeed;
}

/// One seat of the roster: the twin of the kernel's `Seat`.
///
/// Its own type rather than the generated wire [Seat] because the record is
/// persisted by this package and must not move whenever the OpenAPI client is
/// regenerated; [toSeat] is the one-line bridge.
final class LocalSeat {
  const LocalSeat({
    required this.playerIndex,
    required this.userId,
    required this.botId,
    required this.type,
  });

  factory LocalSeat.fromJson(Map<String, dynamic> json) => LocalSeat(
    playerIndex: json['playerIndex'] as int,
    userId: json['userId'] as String?,
    botId: json['botId'] as String?,
    type: SeatTypeEnum.values.firstWhere(
      (value) => value.value == json['type'],
      orElse: () => SeatTypeEnum.unknownDefaultOpenApi,
    ),
  );

  final int playerIndex;

  /// The human behind the seat, or null for a bot seat.
  final String? userId;

  /// The bot registry row behind the seat, or null for a human seat.
  final String? botId;

  final SeatTypeEnum type;

  /// Whether anyone is behind this seat. A seat with neither id can never act
  /// and must never be pending.
  bool get isIdentified => userId != null || botId != null;

  /// The wire seat, for a session this package states.
  Seat toSeat() =>
      Seat(playerIndex: playerIndex, userId: userId, botId: botId, type: type);

  /// The inverse, for a record rebuilt from the server's copy of a local game.
  factory LocalSeat.fromSeat(Seat seat) => LocalSeat(
    playerIndex: seat.playerIndex,
    userId: seat.userId,
    botId: seat.botId,
    type: seat.type,
  );

  Map<String, dynamic> toJson() => {
    'playerIndex': playerIndex,
    'userId': userId,
    'botId': botId,
    'type': type.value,
  };
}

/// Who submitted a move. A local game logs a brain's move as `bot`, which is
/// exactly what the import route replays it as.
enum LocalActor {
  user('user'),
  bot('bot');

  const LocalActor(this.wire);

  final String wire;
}

/// The performer recorded on a logged transition: the twin of the TypeScript
/// `ActionType`.
enum LocalActionType {
  user('user'),
  bot('bot'),
  system('system');

  const LocalActionType(this.wire);

  final String wire;

  static LocalActionType fromWire(String value) => values.firstWhere(
    (type) => type.wire == value,
    orElse: () => throw FormatException('Unknown action type $value'),
  );
}

/// Which species a logged transition is: the twin of the TypeScript
/// `ActionKind`. A `game` action is rules-scoped and rejectable; a `lifecycle`
/// action is engine-scoped and always resolves.
enum LocalActionKind {
  game('game'),
  lifecycle('lifecycle');

  const LocalActionKind(this.wire);

  final String wire;

  static LocalActionKind fromWire(String value) => values.firstWhere(
    (kind) => kind.wire == value,
    orElse: () => throw FormatException('Unknown action kind $value'),
  );
}

/// What the device asks the kernel to do: the twin of the kernel's `Intent`,
/// restricted to the three a local game can raise.
///
/// There is no `timeout`: a local game is untimed, so no clock can raise one,
/// and no `autoForfeit`: an account purge is the server's business.
sealed class LocalIntent {
  const LocalIntent();
}

/// Begin the game at version 0 with a freshly minted base [seed].
final class LocalStartIntent extends LocalIntent {
  const LocalStartIntent(this.seed);

  final String seed;
}

/// A move by [seat], decided against [expectedVersion].
final class LocalActionIntent extends LocalIntent {
  const LocalActionIntent({
    required this.seat,
    required this.expectedVersion,
    required this.data,
    required this.actor,
  });

  final int seat;

  /// The version the move was decided against.
  ///
  /// The server arbitrates a stale value with the same-view rule; here it must
  /// equal the current version. One device is the only actor in a local game,
  /// so a mismatch is a client bug rather than a genuine race, and rejecting
  /// it keeps the local kernel from having to store and compare frames the way
  /// the same-view rule does.
  final int expectedVersion;

  final Map<String, dynamic> data;
  final LocalActor actor;
}

/// Resign [seat]. Unconditional: no pending, version or deadline guard.
final class LocalForfeitIntent extends LocalIntent {
  const LocalForfeitIntent(this.seat);

  final int seat;
}

/// The transition log entry for one commit: the twin of the kernel's
/// `TransitionAction`, and the exact JSON shape the import route replays.
///
/// Null on the start transition, which no action produced. [playerIndex] is
/// the performer's seat, and null for an identity-less system action.
final class LocalTransitionAction {
  const LocalTransitionAction({
    required this.type,
    required this.kind,
    required this.data,
    required this.playerIndex,
  });

  factory LocalTransitionAction.fromJson(Map<String, dynamic> json) =>
      LocalTransitionAction(
        type: LocalActionType.fromWire(json['type'] as String),
        kind: LocalActionKind.fromWire(json['kind'] as String),
        data: (json['data'] as Map).cast<String, dynamic>(),
        playerIndex: json['playerIndex'] as int?,
      );

  final LocalActionType type;
  final LocalActionKind kind;
  final Map<String, dynamic> data;
  final int? playerIndex;

  Map<String, dynamic> toJson() => {
    'type': type.wire,
    'kind': kind.wire,
    'data': data,
    'playerIndex': playerIndex,
  };
}

/// One seat's projected frame: the twin of the kernel's `ObservationFrame`.
/// No raw state escapes the kernel except through this projection.
final class LocalObservationFrame {
  const LocalObservationFrame({
    required this.playerIndex,
    required this.data,
    required this.pendingPlayers,
  });

  factory LocalObservationFrame.fromJson(Map<String, dynamic> json) =>
      LocalObservationFrame(
        playerIndex: json['playerIndex'] as int,
        data: (json['data'] as Map).cast<String, dynamic>(),
        pendingPlayers: (json['pendingPlayers'] as List).cast<int>(),
      );

  final int playerIndex;
  final Map<String, dynamic> data;
  final List<int> pendingPlayers;

  Map<String, dynamic> toJson() => {
    'playerIndex': playerIndex,
    'data': data,
    'pendingPlayers': pendingPlayers,
  };
}

/// Something the engine should do after applying a plan: the twin of the
/// kernel's `Effect`, holding only the one a local game has.
///
/// There is no turn or finish notification: the one human is holding the
/// device the transition just happened on.
sealed class LocalEffect {
  const LocalEffect();
}

/// A bot seat became pending and its brain should run.
final class LocalWakeBot extends LocalEffect {
  const LocalWakeBot({required this.seat, required this.botId});

  final int seat;
  final String botId;
}

/// What one commit produced: either a plan to apply, or a refusal. Sealed so a
/// caller must handle both, where the TypeScript twin needs an `isRejected`
/// type guard.
sealed class LocalCommitResult {
  const LocalCommitResult();
}

/// The transition to apply: the twin of the kernel's `CommitPlan`.
final class LocalCommitPlan extends LocalCommitResult {
  const LocalCommitPlan({
    required this.nextState,
    required this.action,
    required this.frames,
    required this.outcomes,
    required this.effects,
  });

  /// The next transition row, already versioned.
  final LocalStateRow nextState;

  /// The log entry, or null for the start transition.
  final LocalTransitionAction? action;

  /// Per-seat projections, identified seats only.
  final List<LocalObservationFrame> frames;

  /// Per-seat results when this transition ends the game, else null.
  final List<Outcome>? outcomes;

  final List<LocalEffect> effects;
}

/// An intent the kernel refused: the twin of the kernel's `Rejected`. A value,
/// not a throw, because a rejection is part of the normal protocol.
final class LocalRejected extends LocalCommitResult {
  const LocalRejected(this.code, this.message);

  final LocalRejectCode code;
  final String message;
}

/// Projects the new state into one slice per seat: the port of the kernel's
/// `fanOutObservations`.
///
/// [cause] arrives erased and is re-typed by the unit itself, because the
/// caller holds the rules as [AnyLocalGameRules] and cannot build a
/// `TransitionCause` carrying this version's action type.
List<LocalObservationFrame> fanOutObservations(
  AnyLocalGameRules rules, {
  required Object? state,
  required List<int> pending,
  required int participantCount,
  required TransitionCause<Object?> cause,
  required bool isReplay,
  required Object? config,
}) {
  final retyped = rules.retypeCause(cause);
  final frames = <LocalObservationFrame>[];
  for (var seat = 0; seat < participantCount; seat++) {
    final slice = rules.computeObservation(
      state: state,
      pending: pending,
      playerIndex: seat,
      participantCount: participantCount,
      cause: retyped,
      isReplay: isReplay,
      config: config,
    );
    // A projection may mask OTHER seats' pending status for hidden
    // information, but it must be truthful about the seat itself: the frame is
    // what gates that seat's input, so a lie here soft-locks the player or
    // produces taps that always reject. Caught at the source, exactly as the
    // server catches it.
    if (slice.pendingPlayers.contains(seat) != pending.contains(seat)) {
      throw LocalGameBugError(
        'computeObservation for seat $seat misreports the seat\'s own '
        'pending status',
      );
    }
    frames.add(
      LocalObservationFrame(
        playerIndex: seat,
        data: rules.serializeObservation(slice.data),
        pendingPlayers: slice.pendingPlayers,
      ),
    );
  }
  return frames;
}

/// One state transition in, one plan or rejection out: the port of the
/// kernel's `commit()` in `server/packages/kernel/src/commit.ts`, restricted to
/// what a local game can need.
///
/// Zero I/O and no clock, because everything the server's clock decides
/// (deadlines, budget banks, timeout abstains, the grace window) belongs to a
/// timed game and a local game is untimed. What is left is the part that
/// decides the game: the status and pending guards, the version check, the
/// hooks, and every source-level guard the server applies to what a hook
/// returned. The engine loads the record, calls this, and applies the plan.
LocalCommitResult localCommit({
  required LocalGameMeta game,
  required LocalStateRow? state,
  required List<LocalSeat> roster,
  required LocalIntent intent,
  required AnyLocalGameRules rules,
}) => switch (intent) {
  LocalStartIntent() => _commitStart(game, roster, intent, rules),
  LocalActionIntent() => _commitAction(game, state, roster, intent, rules),
  LocalForfeitIntent() => _commitForfeit(game, state, roster, intent, rules),
};

LocalCommitResult _commitStart(
  LocalGameMeta game,
  List<LocalSeat> roster,
  LocalStartIntent intent,
  AnyLocalGameRules rules,
) {
  // A duplicate start of a running game is a clean no-op, not an error.
  if (game.status == GameStatus.active) {
    return const LocalRejected(
      LocalRejectCode.abstain,
      'Game is already active',
    );
  }
  if (game.status != GameStatus.ready) {
    return const LocalRejected(
      LocalRejectCode.notReady,
      'Game is not ready to start',
    );
  }
  if (intent.seed.isEmpty) {
    throw LocalGameBugError('start intent carries an empty rng seed');
  }

  final config = _parseStored(
    () => rules.parseConfig(game.config),
    'config',
    game.schemaVersion,
  );
  final envelope = rules.initialState(
    config: config,
    rng: EigenRng.forTransition(intent.seed, 0),
    playerCount: roster.length,
  );

  return _buildPlan(
    game: game,
    roster: roster,
    rules: rules,
    version: 0,
    seed: intent.seed,
    envelope: envelope,
    config: config,
    action: null,
    cause: const NoCause<Object?>(),
  );
}

LocalCommitResult _commitAction(
  LocalGameMeta game,
  LocalStateRow? state,
  List<LocalSeat> roster,
  LocalActionIntent intent,
  AnyLocalGameRules rules,
) {
  if (state == null) {
    throw LocalGameBugError('action intent reached localCommit before v0');
  }
  if (game.status != GameStatus.active) {
    return const LocalRejected(LocalRejectCode.notActive, 'Game is not active');
  }
  if (intent.expectedVersion != state.version) {
    // The server arbitrates a stale action with the same-view rule; on one
    // device there is no second actor for a genuine race, so any mismatch is
    // the client asking about a board that no longer exists.
    return LocalRejected(
      LocalRejectCode.stateUpdated,
      'Expected version ${intent.expectedVersion} is not the current version '
      '(${state.version})',
    );
  }
  if (!state.pending.contains(intent.seat)) {
    return const LocalRejected(LocalRejectCode.notPending, 'Not your turn');
  }

  final config = _parseStored(
    () => rules.parseConfig(game.config),
    'config',
    game.schemaVersion,
  );
  final priorState = _parseStored(
    () => rules.parseState(state.state),
    'state',
    game.schemaVersion,
  );

  final Object? data;
  try {
    data = rules.parseAction(intent.data);
  } on Object catch (error) {
    return LocalRejected(
      LocalRejectCode.invalidPayload,
      'Invalid action: $error',
    );
  }

  final Envelope<Object?> envelope;
  try {
    envelope = rules.applyAction(
      state: priorState,
      pending: state.pending,
      data: data,
      playerIndex: intent.seat,
      rng: EigenRng.forTransition(state.rngSeed, state.version + 1),
      config: config,
    );
  } on IllegalMoveException catch (error) {
    return LocalRejected(LocalRejectCode.illegalMove, error.message);
  }

  // The log carries what the codec produced, not the raw submission, so what
  // the server replays is the sanitized payload the hooks actually saw.
  final logged = rules.serializeAction(data);
  return _buildPlan(
    game: game,
    roster: roster,
    rules: rules,
    version: state.version + 1,
    seed: state.rngSeed,
    envelope: envelope,
    config: config,
    action: LocalTransitionAction(
      type: intent.actor == LocalActor.user
          ? LocalActionType.user
          : LocalActionType.bot,
      kind: LocalActionKind.game,
      data: logged,
      playerIndex: intent.seat,
    ),
    cause: GameCause<Object?>(data: data, playerIndex: intent.seat),
    actingSeat: intent.seat,
  );
}

LocalCommitResult _commitForfeit(
  LocalGameMeta game,
  LocalStateRow? state,
  List<LocalSeat> roster,
  LocalForfeitIntent intent,
  AnyLocalGameRules rules,
) {
  if (state == null) {
    throw LocalGameBugError('forfeit intent reached localCommit before v0');
  }
  if (game.status != GameStatus.active) {
    return const LocalRejected(LocalRejectCode.notActive, 'Game is not active');
  }

  final config = _parseStored(
    () => rules.parseConfig(game.config),
    'config',
    game.schemaVersion,
  );
  final priorState = _parseStored(
    () => rules.parseState(state.state),
    'state',
    game.schemaVersion,
  );

  final data = LifecycleForfeit(intent.seat);
  final envelope = rules.applyLifecycle(
    state: priorState,
    pending: state.pending,
    type: LifecycleType.forfeit,
    data: data,
    rng: EigenRng.forTransition(state.rngSeed, state.version + 1),
    config: config,
  );
  // A hook that leaves the forfeited seat pending would strand the game on a
  // seat that has given up and can never act again.
  if (envelope.pendingPlayers.contains(intent.seat)) {
    throw LocalGameBugError(
      'Forfeit hook left the forfeited seat ${intent.seat} in the pending set '
      '(schemaVersion ${game.schemaVersion}); a forfeit must remove its '
      'target seat from pending',
    );
  }

  return _buildPlan(
    game: game,
    roster: roster,
    rules: rules,
    version: state.version + 1,
    seed: state.rngSeed,
    envelope: envelope,
    config: config,
    action: LocalTransitionAction(
      type: LocalActionType.user,
      kind: LocalActionKind.lifecycle,
      data: data.toJson(),
      playerIndex: intent.seat,
    ),
    cause: LifecycleCause<Object?>(data: data),
    actingSeat: intent.seat,
  );
}

/// The shared transition builder: the port of the kernel's `buildPlan`, with
/// every source-level guard it applies to a hook's envelope.
LocalCommitPlan _buildPlan({
  required LocalGameMeta game,
  required List<LocalSeat> roster,
  required AnyLocalGameRules rules,
  required int version,
  required String seed,
  required Envelope<Object?> envelope,
  required Object? config,
  required LocalTransitionAction? action,
  required TransitionCause<Object?> cause,
  int? actingSeat,
}) {
  final state = _assertHookState(rules, envelope, game.schemaVersion);
  _assertPendingIdentified(roster, envelope, game.schemaVersion);
  final outcomes = _validateOutcomes(envelope, roster, game.schemaVersion);

  // No viewer, no frame: a seat with neither id could never read its own
  // projection, mirroring the server's filter.
  final identified = {
    for (final seat in roster)
      if (seat.isIdentified) seat.playerIndex,
  };
  final frames = fanOutObservations(
    rules,
    state: envelope.state,
    pending: envelope.pendingPlayers,
    participantCount: roster.length,
    cause: cause,
    isReplay: false,
    config: config,
  ).where((frame) => identified.contains(frame.playerIndex)).toList();

  return LocalCommitPlan(
    nextState: LocalStateRow(
      version: version,
      state: state,
      pending: envelope.pendingPlayers,
      rngSeed: seed,
    ),
    action: action,
    frames: frames,
    outcomes: outcomes,
    effects: _computeEffects(roster, envelope, outcomes, actingSeat),
  );
}

/// Validates the state a hook returned by round-tripping it through this
/// version unit's codec, which is the Dart equivalent of the server's schema
/// re-validation: a hook that wrote a malformed or wrong-version shape fails
/// at the transition that created it rather than on the next read. The
/// serialized form is also what the record persists, so one pass does both.
Map<String, dynamic> _assertHookState(
  AnyLocalGameRules rules,
  Envelope<Object?> envelope,
  int schemaVersion,
) {
  try {
    final json = rules.serializeState(envelope.state);
    rules.parseState(json);
    return json;
  } on Object catch (error) {
    throw LocalGameBugError(
      'Hook-returned state failed validation for schemaVersion '
      '$schemaVersion: $error',
    );
  }
}

/// Enforces that every pending seat has someone behind it. A seat with no
/// identity can never act, so a hook returning it as pending would strand the
/// game forever.
void _assertPendingIdentified(
  List<LocalSeat> roster,
  Envelope<Object?> envelope,
  int schemaVersion,
) {
  final identified = {
    for (final seat in roster)
      if (seat.isIdentified) seat.playerIndex,
  };
  for (final seat in envelope.pendingPlayers) {
    if (!identified.contains(seat)) {
      throw LocalGameBugError(
        'Hook returned pending seat $seat, which has no identity '
        '(schemaVersion $schemaVersion); a seat nobody holds can never act '
        'and must not be pending',
      );
    }
  }
}

/// Runtime shape check over a game-supplied outcome, the port of the kernel's
/// `validateOutcomes`. Two of the server's four checks are Dart's type system
/// here: `placement` and `teamIndex` cannot be absent from an [Outcome].
List<Outcome>? _validateOutcomes(
  Envelope<Object?> envelope,
  List<LocalSeat> roster,
  int schemaVersion,
) {
  final outcome = envelope.outcome;
  if (outcome == null) return null;
  if (outcome.isEmpty) {
    throw LocalGameBugError(
      'Hook returned an empty outcome (schemaVersion $schemaVersion)',
    );
  }
  for (final entry in outcome) {
    if (!roster.any((seat) => seat.playerIndex == entry.playerIndex)) {
      throw LocalGameBugError(
        'Outcome references unknown playerIndex ${entry.playerIndex}',
      );
    }
  }
  return outcome;
}

/// Post-commit work: a wake for every newly pending bot seat, including the
/// acting seat re-entering pending, because a brain has no live client and its
/// only signal to move again is a fresh wake. A finished game wakes nobody.
List<LocalEffect> _computeEffects(
  List<LocalSeat> roster,
  Envelope<Object?> envelope,
  List<Outcome>? outcomes,
  int? actingSeat,
) {
  if (outcomes != null) return const [];
  final effects = <LocalEffect>[];
  for (final seat in envelope.pendingPlayers) {
    for (final member in roster) {
      if (member.playerIndex != seat) continue;
      final botId = member.botId;
      if (botId != null) {
        effects.add(LocalWakeBot(seat: seat, botId: botId));
      }
    }
  }
  return effects;
}

/// Parses a stored payload. Failure means a record this build can no longer
/// read, which is an engine-side bug rather than a caller's mistake, so it
/// throws exactly as the server's `parseStoredPayload` does.
T _parseStored<T>(T Function() parse, String what, int schemaVersion) {
  try {
    return parse();
  } on Object catch (error) {
    throw LocalGameBugError(
      'Stored $what failed validation for schemaVersion $schemaVersion: '
      '$error',
    );
  }
}
