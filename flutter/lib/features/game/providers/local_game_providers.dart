import 'dart:async';

import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/core/connectivity/connectivity_provider.dart';
import 'package:eigen_flutter/core/game/game_module.dart';
import 'package:eigen_flutter/core/local/drift_local_game_store.dart';
import 'package:eigen_flutter/core/local/isolate_bot_runner.dart';
import 'package:eigen_flutter/core/storage/storage_provider.dart';
import 'package:eigen_flutter/features/auth/providers/auth_providers.dart';
import 'package:eigen_flutter/features/game/providers/game_providers.dart';
import 'package:eigen_flutter/features/game/utils/bot_compatibility.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'local_game_providers.g.dart';

/// Where this device keeps the games it played offline.
@Riverpod(keepAlive: true)
Future<LocalGameStore> localGameStore(Ref ref) async =>
    DriftLocalGameStore(await ref.watch(localDatabaseProvider.future));

/// Where a bot's brain runs: an isolate on native, the main thread on the web.
@Riverpod(keepAlive: true)
BotRunner botRunner(Ref ref) => const IsolateBotRunner();

/// Every local game the signed-in user holds on this device.
///
/// Records are keyed by their creator, so signing out and back in finds them
/// again and a second account never sees another's games.
@riverpod
Future<List<LocalGameRecord>> localGames(Ref ref) async {
  final userId = ref.watch(currentUserIdProvider);
  if (userId == null) return const [];
  final records = await (await ref.watch(
    localGameStoreProvider.future,
  )).list(userId);
  return records..sort((a, b) => b.createdAt.compareTo(a.createdAt));
}

/// One local game's record, or null when this device holds none under that id
/// (an ordinary server game, or one another device played).
@riverpod
Future<LocalGameRecord?> localGameRecord(
  Ref ref, {
  required String gameId,
}) async {
  final store = await ref.watch(localGameStoreProvider.future);
  return store.load(gameId);
}

/// The engine driving one local game, or null when the game is not local.
///
/// Keyed by game id and kept alive, so leaving the screen and returning resumes
/// the same serialized queue rather than replaying the record through a second
/// engine. A local game whose version this build no longer ships a local unit
/// for fails here, exactly as a server game with an unsupported schema does.
@Riverpod(keepAlive: true)
Future<LocalGameEngine?> localGameEngine(
  Ref ref, {
  required String gameId,
}) async {
  final record = await ref.watch(
    localGameRecordProvider(gameId: gameId).future,
  );
  if (record == null) return null;
  // A diverged record is not played on any further. The server refused a move
  // this device's rules accepted, or another device moved the game, and either
  // way the two copies are of different games from that point. Handing back no
  // engine is what stops local play: the session falls through to the server's
  // copy, which is the one that counts, and commands are refused rather than
  // committed onto a log the server will never take.
  if (record.diverged) return null;
  final module = ref.watch(currentGameModuleProvider);
  final local = module.versions[record.schemaVersion]?.local;
  if (local == null) {
    throw UnsupportedGameSchemaException(
      gameSchema: record.schemaVersion,
      supportedSchema: module.latestSchemaVersion,
    );
  }
  final engine = LocalGameEngine(
    record: record,
    rules: local,
    store: await ref.watch(localGameStoreProvider.future),
    bots: await ref.watch(botCatalogByIdProvider.future),
    botRunner: ref.watch(botRunnerProvider),
  );
  // A finished game is worth carrying to the server straight away: it is the
  // moment the record stops changing, so the next pass has nothing left to do.
  final finished = engine.sessions.listen((session) {
    if (session.status == GameStatus.finished ||
        session.status == GameStatus.aborted) {
      unawaited(ref.read(localSyncCoordinatorProvider.notifier).run());
    }
  }, onError: (Object _) {});
  ref.onDispose(() {
    unawaited(finished.cancel());
    unawaited(engine.close());
  });
  return engine;
}

/// Brings a local game this device does not hold onto this device.
///
/// The second half of resume (decision 0012): a game played on a phone is
/// visible from a tablet once it has synchronized, and this is what makes it
/// playable there. It reads the record the server kept, re-derives every seat's
/// frame through this build's own rules, and saves it, after which
/// [localGameRecordProvider] finds it and the session switches to the engine.
///
/// Driven by the session rather than by the store, which is what keeps it off
/// the hot path: an ordinary server game is recognised from the snapshot the
/// socket already delivered, and costs no request at all. It is also what
/// breaks the cycle, since the engine reads the record and the record must not
/// read the engine.
///
/// Also how a diverged record recovers: the local copy is dropped and the
/// server's is pulled in its place, which is the only reconciliation there is
/// once the two have committed different moves at the same version.
///
/// Four things are checked before anything is pulled, because a record this
/// build cannot play is worse than no record: the game must be local-origin,
/// the caller must be its creator, this build must ship a local unit for its
/// version, and it must ship a brain for every bot on the roster. A bot added
/// in a later release is the realistic case, and it leaves the game readable
/// here rather than stuck waiting for a move that can never come.
@riverpod
Future<LocalGameRecord?> localGameCatchUp(
  Ref ref, {
  required String gameId,
}) async {
  final session = await ref.watch(gameSessionProvider(gameId: gameId).future);
  if (session.snapshot.origin != GameOrigin.local) return null;
  final store = await ref.watch(localGameStoreProvider.future);
  final held = await store.load(gameId);
  // A diverged record is deliberately not kept. Its unsynchronized moves are
  // the ones the server refused, so they are discarded and the game is pulled
  // again; that is what makes divergence recoverable rather than a game the
  // player can never open again. Everything else held here is already current.
  if (held != null && !held.diverged) return held;

  if (session.snapshot.createdBy != ref.watch(currentUserIdProvider)) {
    return null;
  }
  final module = ref.watch(currentGameModuleProvider);
  final local = module.versions[session.snapshot.schemaVersion]?.local;
  if (local == null) return null;
  final bots = await ref.watch(botCatalogByIdProvider.future);
  for (final seat in session.snapshot.players) {
    final botId = seat.botId;
    if (botId == null) continue;
    final bot = bots[botId];
    if (bot == null || !local.hasBotAction(bot.username)) return null;
  }

  final remote = await ref
      .watch(gameRepositoryProvider)
      .getWholeLocalRecord(gameId);
  final record = localRecordFromRemote(remote: remote, rules: local);
  await store.save(record);
  // Every await above is behind us, so this is a plain cache invalidation
  // rather than a write during another provider's build. The session provider
  // re-reads, finds the record, and hands the game to the engine.
  ref.invalidate(localGameRecordProvider(gameId: gameId));
  ref.invalidate(localGamesProvider);
  return record;
}

/// Whether [gameId] is a game this device played offline.
@riverpod
Future<bool> isLocalGame(Ref ref, {required String gameId}) async =>
    await ref.watch(localGameRecordProvider(gameId: gameId).future) != null;

/// Folds a local engine's snapshots into the same [GameSession] a server game
/// produces.
///
/// The subscription is opened before the current snapshot is replayed into it,
/// so a commit landing in between is ordered by `seq` rather than lost. There
/// is no gap recovery: every version of a local game was committed by this
/// queue, in order, so the client cannot be behind one.
Stream<GameSession> localGameSessions(LocalGameEngine engine) {
  late StreamController<GameSession> controller;
  StreamSubscription<Session>? subscription;
  GameSession? held;

  void apply(Session next) {
    final current = held;
    if (current == null) {
      held = GameSession(snapshot: next, frame: next.frame);
    } else if (current.supersededBy(next)) {
      held = current.applySnapshot(next);
    } else {
      return;
    }
    if (!controller.isClosed) controller.add(held!);
  }

  controller = StreamController<GameSession>(
    onListen: () {
      subscription = engine.sessions.listen(
        apply,
        onError: controller.addError,
      );
      apply(engine.current);
    },
    onCancel: () async {
      await subscription?.cancel();
    },
  );
  return controller.stream;
}

/// One game's read-model entry, built from the device's own record.
///
/// A local game has no server row until it synchronizes, and the lists must
/// show it from the moment it exists, so the record answers the same questions
/// the summary does. Every local-only value is fixed here and in
/// `localSession`: private, unrated, untimed, and as large as its roster.
GameSummary localGameSummaryOf(LocalGameRecord record) => GameSummary(
  id: record.id,
  createdBy: record.createdBy,
  status: record.status,
  access: GameAccess.private,
  origin: GameOrigin.local,
  schemaVersion: record.schemaVersion,
  config: record.config,
  turnSeconds: null,
  budgetSeconds: null,
  incrementSeconds: null,
  rated: false,
  ratingPool: null,
  minPlayers: record.roster.length,
  maxPlayers: record.roster.length,
  // A local game cannot be joined, so it has no code to share.
  shortCode: '',
  pendingPlayers: record.latest?.pending,
  turnDeadline: null,
  outcomes: record.outcomes,
  finishedAt: record.finishedAt?.toUtc().millisecondsSinceEpoch,
  createdAt: record.createdAt.toUtc().millisecondsSinceEpoch,
  updatedAt: record.createdAt.toUtc().millisecondsSinceEpoch,
  participants: [for (final seat in record.roster) seat.toSeat()],
);

/// The frames a finished local game replays, for one seat.
///
/// The record already holds every seat's projection per version, which is what
/// the server re-projects on its replay route, so a local replay is a read
/// rather than a fetch.
List<Frame> localReplayFrames(LocalGameRecord record, {required int seat}) => [
  for (final transition in record.transitions)
    if (record.frameFor(seat: seat, version: transition.version)
        case final frame?)
      Frame(
        type: FrameTypeEnum.frame,
        version: transition.version,
        data: frame.data,
        pendingPlayers: frame.pendingPlayers,
        deadline: null,
        playerTimes: null,
        outcomes: transition.version == record.version ? record.outcomes : null,
        ratings: null,
      ),
];

/// Local games still playable, newest first.
@riverpod
Future<List<GameSummary>> localActiveGames(Ref ref) async => [
  for (final record in await ref.watch(localGamesProvider.future))
    if (!record.isTerminal) localGameSummaryOf(record),
];

/// Local games that have ended, newest finish first.
@riverpod
Future<List<GameSummary>> localFinishedGames(Ref ref) async {
  final records = await ref.watch(localGamesProvider.future);
  final finished =
      [
        for (final record in records)
          if (record.isTerminal) record,
      ]..sort(
        (a, b) => (b.finishedAt ?? b.createdAt).compareTo(
          a.finishedAt ?? a.createdAt,
        ),
      );
  return [for (final record in finished) localGameSummaryOf(record)];
}

// ── Bots a local game can seat ───────────────────────────────────────────────

/// Bots this build can run on the device for a game using [config].
///
/// Three conditions, all of which the server also enforces at import, so this
/// only avoids offering an opponent that would be refused: the registry row
/// must not be an externally hosted bot, this build's local unit must ship a
/// brain under its username, and the game's own `botSeatable` rule must accept
/// the pairing.
List<Bot> usableLocalBots(
  List<Bot> bots,
  GameModule module, {
  required Map<String, dynamic> config,
}) {
  final rules = module.latestRules;
  final local = rules.local;
  if (local == null) return const [];
  return [
    for (final bot in bots)
      if (bot.type != BotType.external_ &&
          bot.supportsGameSchema(module.latestSchemaVersion) &&
          local.hasBotAction(bot.username) &&
          rules.botSeatable(
            BotSeatableArgs(
              gameConfig: config,
              botConfig: (bot.config as Map).cast<String, dynamic>(),
            ),
          ))
        bot,
  ];
}

/// Whether this build can play any game on the device at all: the local arm of
/// the solo picker's availability.
@riverpod
bool localPlayAvailable(Ref ref) {
  final module = ref.watch(currentGameModuleProvider);
  if (module.latestRules.local == null) return false;
  final untimed = module.creationSpec.timingConfigs.values.any(
    (config) => config is UntimedConfig,
  );
  if (!untimed) return false;
  final bots = ref.watch(availableBotsProvider).value ?? const [];
  return usableLocalBots(
    bots,
    module,
    config: module.creationSpec.defaultConfig,
  ).isNotEmpty;
}

/// Creates and starts a game on the device, and answers with its id.
///
/// No network is involved, which is the whole point: the id, the seed and the
/// opening board are all minted here.
@riverpod
Future<String> Function({
  required Map<String, dynamic> config,
  required List<String> botIds,
})
createLocalGame(Ref ref) {
  return ({
    required Map<String, dynamic> config,
    required List<String> botIds,
  }) async {
    final userId = ref.read(currentUserIdProvider);
    if (userId == null) {
      throw StateError('A local game needs a signed-in user to belong to');
    }
    final module = ref.read(currentGameModuleProvider);
    final local = module.latestRules.local;
    if (local == null) {
      throw StateError(
        'This build ships no local rules for the latest version',
      );
    }
    final engine = await LocalGameEngine.create(
      userId: userId,
      schemaVersion: module.latestSchemaVersion,
      config: config,
      botIds: botIds,
      bots: await ref.read(botCatalogByIdProvider.future),
      rules: local,
      store: await ref.read(localGameStoreProvider.future),
      botRunner: ref.read(botRunnerProvider),
    );
    await engine.close();
    ref.invalidate(localGamesProvider);
    return engine.record.id;
  };
}

// ── Synchronization ──────────────────────────────────────────────────────────

/// Carries this device's local games to the server, or null when nobody is
/// signed in.
@Riverpod(keepAlive: true)
Future<LocalGameSync?> localGameSync(Ref ref) async {
  final userId = ref.watch(currentUserIdProvider);
  if (userId == null) return null;
  return LocalGameSync(
    store: await ref.watch(localGameStoreProvider.future),
    games: ref.watch(gameRepositoryProvider),
    userId: userId,
  );
}

/// Runs synchronization when there is reason to, and holds what the last pass
/// found.
///
/// Three reasons, and they are the three moments a pass can newly succeed:
/// somebody signs in, the device regains connectivity, and a local game
/// finishes. Nothing here blocks play: the coordinator's own state is the
/// report, and a failed pass simply leaves work for the next one.
@Riverpod(keepAlive: true)
class LocalSyncCoordinator extends _$LocalSyncCoordinator {
  @override
  LocalSyncReport? build() {
    ref.listen(isOfflineProvider, (previous, next) {
      if (previous == true && next == false) unawaited(run());
    });
    ref.listen(currentUserIdProvider, (previous, next) {
      if (next != null && next != previous) unawaited(run());
    }, fireImmediately: true);
    return null;
  }

  /// Carries every unsynchronized game. Single-flight inside [LocalGameSync],
  /// so overlapping reasons collapse into one pass.
  Future<void> run() async {
    final sync = await ref.read(localGameSyncProvider.future);
    if (sync == null) return;
    final report = await sync.syncAll();
    if (!ref.mounted) return;
    state = report;
    if (report.outcomes.isNotEmpty) ref.invalidate(localGamesProvider);
  }
}

// ── Commands ─────────────────────────────────────────────────────────────────

/// The two commands a game screen issues, wherever the game is played.
///
/// A local game and a server game differ in who decides, not in what the screen
/// asks for, so the screen asks through this and never branches. Both
/// implementations answer with the acting seat's committed session and throw
/// [EngineException] on a refusal.
abstract interface class GameCommands {
  Future<CommandAccepted> submitAction({
    required int seat,
    required Map<String, dynamic> data,
    required int expectedVersion,
  });

  Future<CommandAccepted> forfeit({required int seat});
}

/// Commands against the authoritative server.
final class ServerGameCommands implements GameCommands {
  const ServerGameCommands(this._games, this._gameId);

  final GameRepository _games;
  final String _gameId;

  @override
  Future<CommandAccepted> submitAction({
    required int seat,
    required Map<String, dynamic> data,
    required int expectedVersion,
  }) => _games.submitAction(
    gameId: _gameId,
    seat: seat,
    data: data,
    expectedVersion: expectedVersion,
  );

  @override
  Future<CommandAccepted> forfeit({required int seat}) =>
      _games.forfeitGame(gameId: _gameId, seat: seat);
}

/// Commands against the device's own engine.
final class LocalGameCommands implements GameCommands {
  const LocalGameCommands(this._engine);

  final LocalGameEngine _engine;

  @override
  Future<CommandAccepted> submitAction({
    required int seat,
    required Map<String, dynamic> data,
    required int expectedVersion,
  }) => _engine.submitAction(
    seat: seat,
    data: data,
    expectedVersion: expectedVersion,
  );

  @override
  Future<CommandAccepted> forfeit({required int seat}) =>
      _engine.forfeit(seat: seat);
}

/// Refuses every command, for a local game this device cannot play.
///
/// A synchronized local game is visible from any of its owner's devices, and
/// [localGameCatchUp] brings it to one that can play it. What is left here is
/// the case it declines: a build with no local unit for the game's version, or
/// none for a bot on its roster. Only the device running the record can move
/// such a game, because the server dispatches nothing for a local-origin one,
/// so a move sent anyway would commit a turn no bot would ever answer.
final class UnplayableLocalGameCommands implements GameCommands {
  const UnplayableLocalGameCommands();

  static const _refusal = EngineException(
    'This game was played on another device.',
    code: ErrorCode.localOnly,
  );

  @override
  Future<CommandAccepted> submitAction({
    required int seat,
    required Map<String, dynamic> data,
    required int expectedVersion,
  }) => throw _refusal;

  @override
  Future<CommandAccepted> forfeit({required int seat}) => throw _refusal;
}

/// How to command one game, resolved once from where it is played.
@riverpod
Future<GameCommands> gameCommands(Ref ref, {required String gameId}) async {
  final engine = await ref.watch(
    localGameEngineProvider(gameId: gameId).future,
  );
  if (engine != null) return LocalGameCommands(engine);
  // A local-origin game with no engine is one this build declined to bring
  // here, or one whose record has diverged; see [localGameCatchUp] for what it
  // checks first, and [localGameEngine] for the divergence case.
  final session = ref.watch(gameSessionProvider(gameId: gameId)).value;
  if (session?.snapshot.origin == GameOrigin.local) {
    return const UnplayableLocalGameCommands();
  }
  return ServerGameCommands(ref.watch(gameRepositoryProvider), gameId);
}
