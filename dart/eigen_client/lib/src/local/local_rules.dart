import 'dart:async';

import 'package:eigen_api/eigen_api.dart';

/// Deterministic random source for one transition: the twin of the TypeScript
/// `Rng` in `server/packages/rules/src/contract.ts`.
///
/// The local kernel derives it from the game's base seed and the version the
/// envelope commits as, exactly as the server's `deriveRng` does, so a hook
/// that draws in deterministic code order replays identically on the device
/// and on the server. `EigenRng` is the implementation; a test may substitute
/// any other.
abstract interface class Rng {
  /// The next draw in `[0, 1)`. Stateful within one transition.
  double next();
}

/// The result of advancing a local game by one transition: the twin of the
/// TypeScript `Envelope`, and the return of every state hook.
///
/// `turnSeconds` is deliberately absent. The TypeScript envelope carries a
/// per-action deadline override, and a local game is untimed by definition
/// (decision 0012), so there is no clock for it to override. A version unit
/// that wants a timed variant plays it online.
final class Envelope<TState> {
  const Envelope({
    required this.state,
    required this.pendingPlayers,
    this.outcome,
  });

  /// The new pure game payload. Never carries whose-turn or winner
  /// information; those are engine-owned.
  final TState state;

  /// 0-based seats that may act next. Empty means the game is over.
  final List<int> pendingPlayers;

  /// Present **only** when the game ends; null means ongoing.
  ///
  /// Nullable rather than optional because Dart has no way to tell an absent
  /// named argument from an explicit null, and the TypeScript twin's
  /// `undefined` and `null` both mean "still running" to the kernel.
  final List<Outcome>? outcome;
}

/// One participant's view of the state, produced by
/// [LocalGameRules.computeObservation]: the twin of the TypeScript
/// `ObservationSlice`.
final class ObservationSlice<TObs> {
  const ObservationSlice({required this.data, required this.pendingPlayers});

  /// What this seat is permitted to see.
  final TObs data;

  /// The pending set as this seat sees it. It may mask other seats for a
  /// hidden-information game, but it must stay truthful about the seat
  /// itself, which the local kernel enforces exactly as the server does.
  final List<int> pendingPlayers;
}

/// The trigger of a lifecycle action: the twin of the TypeScript
/// `LifecycleType`.
///
/// A local game never times out (it is untimed), but the enum keeps the
/// vocabulary complete so a unit's `applyLifecycle` reads identically to its
/// TypeScript twin and an imported transcript replays through the same hook.
enum LifecycleType {
  timeout('timeout'),
  forfeit('forfeit'),
  autoForfeit('autoForfeit');

  const LifecycleType(this.wire);

  /// The value the TypeScript side writes to the action log.
  final String wire;

  /// Parses a wire value, rejecting anything this build does not know.
  static LifecycleType fromWire(String value) => values.firstWhere(
    (type) => type.wire == value,
    orElse: () => throw FormatException('Unknown lifecycle type $value'),
  );
}

/// The engine-constructed payload of a lifecycle action, recorded verbatim in
/// the transition log: the twin of the TypeScript `LifecycleAction`.
///
/// Sealed, because the two shapes are the whole vocabulary and a `switch` over
/// them should not need a default. The JSON is exactly the TypeScript shape
/// (`{"type":"timeout"}` and `{"type":"forfeit","playerIndex":n}`), because the
/// import route replays these payloads through the authoritative hooks.
sealed class LifecycleAction {
  const LifecycleAction();

  /// The trigger, always equal to this variant's own type.
  LifecycleType get type;

  /// The seat the action targets, or null for a timeout, which targets every
  /// pending seat at once.
  int? get playerIndex;

  Map<String, dynamic> toJson();

  /// Rebuilds a payload from a stored transition log.
  factory LifecycleAction.fromJson(Map<String, dynamic> json) {
    final type = LifecycleType.fromWire(json['type'] as String);
    return switch (type) {
      LifecycleType.timeout => const LifecycleTimeout(),
      LifecycleType.forfeit => LifecycleForfeit(json['playerIndex'] as int),
      LifecycleType.autoForfeit => LifecycleAutoForfeit(
        json['playerIndex'] as int,
      ),
    };
  }
}

/// The clock ran out for every seat in the pending set.
final class LifecycleTimeout extends LifecycleAction {
  const LifecycleTimeout();

  @override
  LifecycleType get type => LifecycleType.timeout;

  @override
  int? get playerIndex => null;

  @override
  Map<String, dynamic> toJson() => {'type': type.wire};
}

/// A voluntary resign by [playerIndex].
final class LifecycleForfeit extends LifecycleAction {
  const LifecycleForfeit(this.playerIndex);

  @override
  LifecycleType get type => LifecycleType.forfeit;

  @override
  final int playerIndex;

  @override
  Map<String, dynamic> toJson() => {
    'type': type.wire,
    'playerIndex': playerIndex,
  };
}

/// The engine-driven forfeit (an account purge), which a local game only ever
/// sees when replaying a record the server resolved.
final class LifecycleAutoForfeit extends LifecycleAction {
  const LifecycleAutoForfeit(this.playerIndex);

  @override
  LifecycleType get type => LifecycleType.autoForfeit;

  @override
  final int playerIndex;

  @override
  Map<String, dynamic> toJson() => {
    'type': type.wire,
    'playerIndex': playerIndex,
  };
}

/// What produced the state being projected: the twin of the TypeScript
/// `TransitionCause`, whose `null` variant is [NoCause] here so the type stays
/// non-nullable and a `switch` stays exhaustive.
///
/// This is how a game tells each seat what happened: a diff of two frames
/// cannot recover causality, so the cue is embedded into the seat's own slice
/// by [LocalGameRules.computeObservation].
sealed class TransitionCause<TAction> {
  const TransitionCause();
}

/// A rules-scoped move by [playerIndex]: the TypeScript `{kind:"game"}`
/// variant.
final class GameCause<TAction> extends TransitionCause<TAction> {
  const GameCause({required this.data, required this.playerIndex});

  final TAction data;
  final int playerIndex;
}

/// An engine-scoped lifecycle action: the TypeScript `{kind:"lifecycle"}`
/// variant.
final class LifecycleCause<TAction> extends TransitionCause<TAction> {
  const LifecycleCause({required this.data});

  final LifecycleAction data;
}

/// The opening frame, which no action produced: the TypeScript `null`.
final class NoCause<TAction> extends TransitionCause<TAction> {
  const NoCause();
}

/// A seated bot's turn to move: the twin of the TypeScript `BotActionArgs`.
///
/// The brain sees exactly what a human at this seat would, so it cannot read
/// hidden state its seat may not. Everything here is plain data or a value the
/// runner reconstructs, because a native bot runs in a short-lived isolate and
/// its inputs must be sendable (decision 0012, "Running bot brains").
final class LocalBotActionArgs<TObs, TConfig> {
  const LocalBotActionArgs({
    required this.observation,
    required this.botConfig,
    required this.playerIndex,
    required this.rng,
    required this.config,
  });

  /// This seat's projection, as [LocalGameRules.computeObservation] produced
  /// it.
  final ObservationSlice<TObs> observation;

  /// The bot registry row's declared knob (difficulty, personality):
  /// game-owned but unversioned by the game schemas, so it stays opaque.
  final Map<String, dynamic> botConfig;

  /// The seat the brain is playing.
  final int playerIndex;

  /// Deterministic per `(game, version, seat)` stream, derived by the engine
  /// as `EigenRng.forBot`. A brain need not be pure: the chosen move is what
  /// gets logged, and replay uses the recorded action.
  final Rng rng;

  /// The game's parsed creation config.
  final TConfig config;
}

/// One local bot brain: the value type of [LocalGameRules.botActions], and the
/// twin of the TypeScript `BotAction`.
///
/// The `FutureOr` return is what lets a web brain yield cooperatively: Flutter
/// has no isolates on the web, so a brain that thinks for long must give the
/// frame back rather than block it.
typedef LocalBotAction<TAction, TObs, TConfig> =
    FutureOr<TAction> Function(LocalBotActionArgs<TObs, TConfig>);

/// A move the game's rules refuse: the twin of the TypeScript
/// `IllegalMoveError`.
///
/// The only throw from [LocalGameRules.applyAction] that is not a bug. The
/// local kernel turns it into a rejection, the same way the server turns it
/// into a 422; any other throw surfaces as [LocalGameBugError].
class IllegalMoveException implements Exception {
  const IllegalMoveException([this.message = 'Illegal move']);

  final String message;

  @override
  String toString() => message;
}

/// A broken game or engine invariant: the twin of the TypeScript
/// `GameBugError`.
///
/// Thrown rather than returned, because no caller can do anything with it
/// except surface a failure and log. A rejection is a value; a bug is a throw.
class LocalGameBugError extends Error {
  LocalGameBugError(this.message);

  final String message;

  @override
  String toString() => 'LocalGameBugError: $message';
}

/// One `schemaVersion` of a game, implemented a second time in Dart so the
/// device can play it with no network: the twin of the TypeScript `GameRules`
/// hooks in `server/packages/rules/src/contract.ts`.
///
/// A version unit MAY ship one of these. Absence means the version cannot be
/// played locally and the solo picker offers no local bots for it (decision
/// 0012). The four state hooks are transcriptions of the authoritative
/// TypeScript ones, parameter name for parameter name, so the two languages
/// read side by side and a shared fixture file can check them against each
/// other. The server's copy stays authoritative: an imported local game is
/// replayed by the TypeScript rules, and a disagreement is surfaced as a
/// divergence rather than resolved in the client's favour.
///
/// The seven codecs at the bottom are what the kernel needs in place of the
/// TypeScript `schemas`: `serializeState` followed by `parseState` is the Dart
/// equivalent of validating a hook's state against its schema, and the
/// transition log, the frames and the import route all cross JSON.
/// `eigen_codegen` emits `<Game>V<N>LocalRulesBase` implementing all seven, so
/// a game supplies behavior only.
abstract class LocalGameRules<TState, TObs, TAction, TConfig> {
  const LocalGameRules();

  /// The starting envelope. Draw any setup randomness (a shuffle, a first
  /// player) from [rng], which the kernel derives at version 0.
  Envelope<TState> initialState({
    required TConfig config,
    required Rng rng,
    required int playerCount,
  });

  /// Applies a player's move.
  ///
  /// The kernel has already confirmed it is this seat's turn at the current
  /// version, so do not re-check turn order. Validate legality only, and throw
  /// [IllegalMoveException] when it fails; any other throw is a game bug.
  Envelope<TState> applyAction({
    required TState state,
    required List<int> pending,
    required TAction data,
    required int playerIndex,
    required Rng rng,
    required TConfig config,
  });

  /// Resolves a lifecycle action into an envelope. Unlike [applyAction] it
  /// cannot be illegal; it always resolves. A local game only ever raises
  /// `forfeit`, but the hook receives the real trigger so an imported game
  /// replays through the same code.
  Envelope<TState> applyLifecycle({
    required TState state,
    required List<int> pending,
    required LifecycleType type,
    required LifecycleAction data,
    required Rng rng,
    required TConfig config,
  });

  /// Projects the state into one seat's view, including what that seat may see
  /// of the transition that produced it ([cause]).
  ///
  /// What this hook reveals is also the game's simultaneous-move policy on the
  /// server, so keeping it a faithful transcription is what makes an imported
  /// local game replay to the same frames.
  ObservationSlice<TObs> computeObservation({
    required TState state,
    required List<int> pending,
    required int? playerIndex,
    required int participantCount,
    required TransitionCause<TAction> cause,
    required bool isReplay,
    required TConfig config,
  });

  /// The on-device bot brains, keyed by bot username exactly like the
  /// TypeScript `botActions`.
  ///
  /// A username present on both sides is one bot playable in both modes; a
  /// username present only here is a `local`-type registry row. External bots
  /// are never local. Default empty: a version unit with no brains ships no
  /// local bots.
  Map<String, LocalBotAction<TAction, TObs, TConfig>> get botActions =>
      const {};

  /// Parses the stored creation config.
  TConfig parseConfig(Map<String, dynamic> json);

  /// Parses a stored state payload. Together with [serializeState] this is the
  /// kernel's schema check: a hook-returned state that does not survive the
  /// round trip is a game bug caught at the transition that created it.
  TState parseState(Map<String, dynamic> json);

  /// Serializes a state payload for the transition log and the import route.
  Map<String, dynamic> serializeState(TState state);

  /// Parses a submitted or logged move.
  TAction parseAction(Map<String, dynamic> json);

  /// Serializes a move for the transition log and the import route. Every
  /// producer (a human tap, a local brain) routes through this one seam, so
  /// what the server replays is what the device played.
  Map<String, dynamic> serializeAction(TAction action);

  /// Parses a stored frame payload.
  TObs parseObservation(Map<String, dynamic> json);

  /// Serializes one seat's projection into the frame the client renders.
  Map<String, dynamic> serializeObservation(TObs observation);

  /// Whether this unit ships a brain under [username].
  ///
  /// Exists for the same reason [retypeCause] does: a caller holding an
  /// [AnyLocalGameRules] cannot read [botActions] at all, because Dart checks
  /// the map's type arguments on the way out and the erased view disagrees with
  /// the concrete one. Asking the unit itself is the only sound way to answer
  /// it, and the bot pickers ask it for every candidate.
  bool hasBotAction(String username) => botActions.containsKey(username);

  /// Re-types an erased cause for this unit's hooks. Engine-facing: game code
  /// neither calls nor overrides it.
  ///
  /// The kernel holds units erased as [AnyLocalGameRules], so it can only
  /// build a `TransitionCause<Object?>`. Dart checks a generic argument's
  /// runtime type when the value crosses into [computeObservation], and
  /// `GameCause<Object?>` is not a `TransitionCause<TAction>`. Inside the class
  /// body TAction is real, so this rebuilds the value with the right runtime
  /// type. TypeScript needs no equivalent because its erasure is total.
  TransitionCause<TAction> retypeCause(TransitionCause<Object?> cause) =>
      switch (cause) {
        GameCause<Object?>(:final data, :final playerIndex) =>
          GameCause<TAction>(data: data as TAction, playerIndex: playerIndex),
        LifecycleCause<Object?>(:final data) => LifecycleCause<TAction>(
          data: data,
        ),
        NoCause<Object?>() => const NoCause(),
      };

  /// Runs the brain registered for [username] across the JSON boundary.
  /// Engine-facing, for the same erasure reason as [retypeCause]: the runner
  /// cannot construct a `LocalBotActionArgs<TObs, TConfig>`, and a bot job has
  /// to be sendable to an isolate anyway, so JSON is the only shape that
  /// works on every platform the client runs on.
  ///
  /// Throws [StateError] when this unit ships no brain for the username, which
  /// is a seating bug: the picker only offers bots it found here.
  Future<Map<String, dynamic>> runBotAction({
    required String username,
    required Map<String, dynamic> observation,
    required List<int> pendingPlayers,
    required Map<String, dynamic> botConfig,
    required int playerIndex,
    required Rng rng,
    required Map<String, dynamic> config,
  }) async {
    final brain = botActions[username];
    if (brain == null) {
      throw StateError('No local bot brain for username "$username"');
    }
    final action = await brain(
      LocalBotActionArgs<TObs, TConfig>(
        observation: ObservationSlice<TObs>(
          data: parseObservation(observation),
          pendingPlayers: pendingPlayers,
        ),
        botConfig: botConfig,
        playerIndex: playerIndex,
        rng: rng,
        config: parseConfig(config),
      ),
    );
    return serializeAction(action);
  }
}

/// A [LocalGameRules] unit with its payload types erased: the twin of the
/// TypeScript `AnyGameRules`, and what the kernel, the engine and the bot
/// runner hold.
///
/// Dart's generics are covariant, so a concrete unit is assignable to this
/// type. Values still carry their real types at runtime, so handing a parsed
/// state straight back into a hook passes Dart's check; only values the
/// erased caller has to *construct* need [LocalGameRules.retypeCause] and
/// [LocalGameRules.runBotAction].
typedef AnyLocalGameRules = LocalGameRules<Object?, Object?, Object?, Object?>;
