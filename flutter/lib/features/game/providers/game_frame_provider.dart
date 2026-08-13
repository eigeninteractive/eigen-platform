import 'package:eigen_api/eigen_api.dart';
import 'package:eigen_flutter/core/api/engine_api_providers.dart';
import 'package:eigen_flutter/core/game/game_frame.dart';
import 'package:eigen_flutter/core/game/game_module.dart';
import 'package:eigen_flutter/core/game/game_transition.dart';
import 'package:eigen_flutter/core/game/timing_context.dart';
import 'package:eigen_flutter/features/game/providers/game_providers.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'game_frame_provider.g.dart';

/// The [GameRules] version unit for a specific game, resolved once from the
/// game's immutable schema version.
///
/// This is the single version-dispatch point on the client: everything
/// downstream (engine, content, bots, seatability) consumes the resolved unit
/// and never branches on version.
@riverpod
Future<GameRules> gameRules(Ref ref, {required String gameId}) async {
  final session = await ref.watch(gameSessionProvider(gameId: gameId).future);
  final module = ref.watch(currentGameModuleProvider);
  final rules = module.versions[session.snapshot.schemaVersion];
  if (rules == null) {
    // Created by a newer build (or a retired version) - refuse rather than
    // mis-parse with the wrong generation of code.
    throw UnsupportedGameSchemaException(
      gameSchema: session.snapshot.schemaVersion,
      supportedSchema: module.latestSchemaVersion,
    );
  }
  return rules;
}

/// The parsed game config, produced once from the immutable config payload.
///
/// Config is set at creation and never mutated, so this is long-lived and
/// stands apart from the per-frame [GameFrame]. Erased to [Object] here - the
/// game casts to its concrete type.
@riverpod
Future<Object> gameConfig(Ref ref, {required String gameId}) async {
  final rules = await ref.watch(gameRulesProvider(gameId: gameId).future);
  final session = await ref.watch(gameSessionProvider(gameId: gameId).future);
  return rules.parseConfig(session.snapshot.config as Map<String, dynamic>)
      as Object;
}

/// How long the current turn was when it started, in milliseconds.
///
/// In budget mode the window *is* the acting seat's bank, and budget mode
/// permits only one pending seat, so that is unambiguous. Otherwise it is the
/// game's configured per-turn length. Null for an untimed game, or when a hook
/// set a per-action deadline the client cannot see - both cases fall back to a
/// truthful, unmargined countdown.
int? _turnWindowMillis(Session snapshot, Frame frame) {
  final banks = frame.playerTimes;
  if (banks != null && frame.pendingPlayers.length == 1) {
    final seat = frame.pendingPlayers.first;
    if (seat < banks.length) return banks[seat];
  }
  final turnSeconds = snapshot.turnSeconds;
  return turnSeconds == null ? null : turnSeconds * 1000;
}

/// Builds the rendered frame for one wire frame, parsing its observation.
GameFrame _frameOf(Ref ref, GameRules rules, Session snapshot, Frame frame) {
  return GameFrame(
    observation:
        rules.parseObservation(frame.data as Map<String, dynamic>) as Object?,
    pendingPlayers: frame.pendingPlayers,
    version: frame.version,
    timing: TimingContext(
      clock: ref.watch(serverClockProvider),
      playerTimes: frame.playerTimes,
      deadline: frame.deadline,
      windowMillis: _turnWindowMillis(snapshot, frame),
    ),
  );
}

/// The per-frame [GameFrame] the game renders from.
///
/// Null before the game is under way: frames only exist from v0 of an active
/// game onward, and there is nothing to project in the waiting room or after an
/// abort.
///
/// The parsed config is intentionally not part of this; consume it separately
/// via [gameConfig].
@riverpod
GameFrame? gameFrame(Ref ref, {required String gameId}) {
  final session = ref.watch(gameSessionProvider(gameId: gameId)).value;
  final rules = ref.watch(gameRulesProvider(gameId: gameId)).value;
  final frame = session?.frame;
  if (session == null || rules == null || frame == null) return null;
  return _frameOf(ref, rules, session.snapshot, frame);
}

/// The step from the frame the player last saw to the one on screen now, or
/// null when there is no step to animate.
///
/// This is the input a game animates from, so that "did I render the
/// predecessor" stops being something every game re-derives in widget state. It
/// is null exactly when animating would be wrong: a cold load, a rejoin, or the
/// opening frame, where the cue is history rather than an event and belongs on
/// screen statically.
@riverpod
GameTransition? gameTransition(Ref ref, {required String gameId}) {
  final session = ref.watch(gameSessionProvider(gameId: gameId)).value;
  final rules = ref.watch(gameRulesProvider(gameId: gameId)).value;
  final from = session?.previousFrame;
  final to = session?.frame;
  if (session == null || rules == null || from == null || to == null) {
    return null;
  }
  // Only a direct successor is a step the player can have watched happen.
  if (to.version != from.version + 1) return null;
  return GameTransition(
    from: _frameOf(ref, rules, session.snapshot, from),
    to: _frameOf(ref, rules, session.snapshot, to),
  );
}
