import 'local_rules.dart';
import 'rng.dart';

/// One bot's turn to think, as the engine hands it to a [BotRunner].
///
/// Everything here is sendable: JSON values, ints, strings, and the rules unit
/// itself, which a game declares `const`. That is the contract decision 0012
/// states under "Running bot brains": on native the Flutter adapter runs each
/// brain through `Isolate.run`, so a slow brain cannot drop a frame, and an
/// isolate can only receive values it can copy. A brain that captures a
/// provider, a widget, or any other live object cannot be run that way.
///
/// The RNG is described rather than passed for the same reason: a stream is
/// stateful and not sendable, so the job carries [seed], [playerIndex] and
/// [version] and the runner reconstructs the identical stream with
/// `EigenRng.forBot` wherever the brain ends up running.
final class LocalBotJob {
  const LocalBotJob({
    required this.rules,
    required this.botUsername,
    required this.observation,
    required this.pendingPlayers,
    required this.botConfig,
    required this.playerIndex,
    required this.config,
    required this.seed,
    required this.version,
  });

  /// The version unit holding the brain. Type-erased, because a runner serves
  /// every game and version.
  final AnyLocalGameRules rules;

  /// The bot registry row's username, which is the key into
  /// [LocalGameRules.botActions].
  final String botUsername;

  /// This seat's projection at the current version: the same fog-of-war frame
  /// a human at the seat would see, so a brain cannot read hidden state.
  final Map<String, dynamic> observation;

  /// The pending set as this seat sees it.
  final List<int> pendingPlayers;

  /// The registry row's declared knob (difficulty, personality).
  final Map<String, dynamic> botConfig;

  /// The seat the brain plays.
  final int playerIndex;

  /// The game's creation config, as stored.
  final Map<String, dynamic> config;

  /// The game's base RNG seed.
  final String seed;

  /// The version the brain's move will commit as.
  final int version;

  /// The stream this job's brain draws from: the twin of what the Durable
  /// Object derives when it wakes a seated bot.
  Rng get rng => EigenRng.forBot(seed, playerIndex, version);
}

/// Where a bot brain runs: the port the Flutter adapter implements.
///
/// The engine never runs game code directly, because a brain has unbounded
/// cost and the platforms differ: native gets a short-lived isolate, the web
/// runs on the main thread (Flutter has no isolates there) and relies on a
/// brain yielding cooperatively, which the `FutureOr` return of
/// [LocalBotAction] permits. Moving web brains into a worker later is a build
/// change behind this port, not a contract change.
abstract interface class BotRunner {
  /// Runs [job]'s brain and answers with the move, serialized through the
  /// version unit's action codec.
  ///
  /// A throw is a failed turn, not a crashed game: the engine reports it and
  /// leaves the seat pending.
  Future<Map<String, dynamic>> run(LocalBotJob job);
}

/// A [BotRunner] that runs the brain on the caller's isolate.
///
/// The web adapter's behavior, and the default a pure-Dart test or a
/// command-line client uses. It awaits the `FutureOr`, so a brain that yields
/// between plies still works; it simply shares the thread while it thinks.
final class InlineBotRunner implements BotRunner {
  const InlineBotRunner();

  @override
  Future<Map<String, dynamic>> run(LocalBotJob job) => job.rules.runBotAction(
    username: job.botUsername,
    observation: job.observation,
    pendingPlayers: job.pendingPlayers,
    botConfig: job.botConfig,
    playerIndex: job.playerIndex,
    rng: job.rng,
    config: job.config,
  );
}
