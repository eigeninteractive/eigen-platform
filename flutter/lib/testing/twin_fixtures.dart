// Dartdoc selects the two supported package entry points by library name.
// ignore_for_file: unnecessary_library_name

/// Twin-drift fixture runner: the Dart half of the shared JSON fixtures
/// that keep a version unit's TS and Dart [GameRules] twins in sync.
///
/// One fixture file per concern lives under `fixtures/v<N>/*.json` and is
/// consumed by both sides: `@eigeninteractive/testkit` runs each case against
/// the TypeScript unit in the game's Worker (schemas + `applyAction` +
/// `computeObservation` + the two predicates), while this library runs the
/// same file against the Dart twin (generated payload parsing,
/// [GameRules.isValidAction], [GameRules.previewAction], and the predicate
/// twins). A behavioral divergence then fails one side's tests instead of
/// degrading UX in production. The fixture file format is documented in
/// the [EigenInteractive testing guide](https://eigeninteractive.com/docs/build-a-game/testing).
///
/// Loading and running are separate steps on purpose. A fixture file is
/// hand-written JSON, so [loadTwinFixtureSuites] validates it into the typed
/// [TwinFixtureCase] hierarchy first: a missing or mistyped field fails at
/// load with the file, case and field named, rather than surfacing later as a
/// confusing comparison failure blamed on the game's rules. By the time
/// [runTwinFixtureCase] sees a case, every field it reads is known-present and
/// known-typed, so it performs no casting at all.
///
/// This side validates fields it never itself reads (`expected.state`,
/// `participantCount`, ...) as well. Those belong to the TS runner, but a game
/// package may ship only a Dart twin, and then this is the only thing
/// standing between a typo and a silently skipped assertion.
///
/// Framework-free on purpose (no `flutter_test` import), so it can live in
/// `lib/` and be consumed by any app's test suite:
///
/// ```dart
/// void main() {
///   const module = MyGameModule();
///   final root = 'test/fixtures/game';
///   for (final suite in loadTwinFixtureSuites(root)) {
///     final rules = module.versions[suite.schemaVersion];
///     group('twin fixtures v${suite.schemaVersion}', () {
///       for (final fixtureCase in suite.cases) {
///         test(fixtureCase.name, () {
///           expect(rules, isNotNull);
///           expect(runTwinFixtureCase(rules!, fixtureCase), isEmpty);
///         });
///       }
///     });
///   }
/// }
/// ```
///
/// The `expected.observation` comparison relies on value equality (`==`).
/// EigenInteractive's generated payload classes provide deep equality for
/// collections.
library eigen_flutter.testing;

import 'dart:convert';
import 'dart:io';

import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/core/game/game_module.dart';

/// One fixture file's cases, all targeting one `schemaVersion` unit.
class TwinFixtureSuite {
  const TwinFixtureSuite({
    required this.path,
    required this.schemaVersion,
    required this.cases,
  });

  /// The fixture file this suite was loaded from, for failure messages.
  final String path;

  /// The `schemaVersion` whose rules unit every case targets.
  final int schemaVersion;

  final List<TwinFixtureCase> cases;
}

/// One validated fixture case. Sealed, so [runTwinFixtureCase] switches
/// exhaustively and an added case kind is a compile error rather than a
/// silently unhandled string.
sealed class TwinFixtureCase {
  const TwinFixtureCase({required this.name});

  /// The case's `name`, used as the test name.
  final String name;
}

/// Exercises the action codec, [GameRules.isValidAction] and, when the game
/// implements optimism, [GameRules.previewAction].
final class ActionCase extends TwinFixtureCase {
  const ActionCase({
    required super.name,
    required this.config,
    required this.state,
    required this.obs,
    required this.action,
    required this.pending,
    required this.playerIndex,
    required this.expectedValid,
    required this.expectedObservation,
    // Defaulted exactly as the fixture format defaults them: a case that
    // records no envelope asserts nothing about one, and one that names
    // neither seat count nor stream means two seats and the shared seed.
    this.expected = const ExpectedEnvelope(),
    this.participantCount = 2,
    this.rngSeed = _defaultRngSeed,
  });

  final Map<String, dynamic> config;

  /// The TS runner's `applyAction` input. Read here only as the fallback for
  /// [obs]; a perfect-information game omits `obs` because the two coincide.
  final Map<String, dynamic> state;

  /// The acting seat's observation payload: the fixture's `obs`, or `state`
  /// when the fixture omits it.
  final Map<String, dynamic> obs;

  final Map<String, dynamic> action;
  final List<int> pending;
  final int playerIndex;
  final bool expectedValid;

  /// The actor's post-action view, or null when the fixture records none.
  final Map<String, dynamic>? expectedObservation;

  /// What the resulting envelope must hold. Checked against the local unit's
  /// own `applyAction`, which is the hook the device actually commits with.
  final ExpectedEnvelope expected;

  /// Seats in the game, for the observation fan-out. Two unless recorded.
  final int participantCount;

  /// The stream the hook draws from. These cases have no version to derive
  /// from, so the fixture names it directly.
  final String rngSeed;
}

/// A [GameRules.ratingPool] predicate case.
final class RatingPoolCase extends TwinFixtureCase {
  const RatingPoolCase({
    required super.name,
    required this.access,
    required this.turnSeconds,
    required this.budgetSeconds,
    required this.incrementSeconds,
    required this.minPlayers,
    required this.maxPlayers,
    required this.config,
    required this.expected,
  });

  final GameAccess access;
  final int? turnSeconds;
  final int? budgetSeconds;
  final int? incrementSeconds;
  final int minPlayers;
  final int maxPlayers;
  final Map<String, dynamic> config;
  final String? expected;
}

/// A [GameRules.playerLimits] case: the seats one config may be played with.
final class PlayerLimitsCase extends TwinFixtureCase {
  const PlayerLimitsCase({
    required super.name,
    required this.config,
    required this.expected,
  });

  final Map<String, dynamic> config;
  final PlayerLimits expected;
}

/// A [GameRules.botSeatable] predicate case.
final class BotSeatableCase extends TwinFixtureCase {
  const BotSeatableCase({
    required super.name,
    required this.gameConfig,
    required this.botConfig,
    required this.expected,
  });

  final Map<String, dynamic> gameConfig;
  final Map<String, dynamic> botConfig;
  final bool expected;
}

/// Loads every fixture file under [rootPath] (layout: `<root>/v<N>/*.json`),
/// sorted by path for stable test ordering.
///
/// Throws [FormatException] on malformed JSON, and on any fixture that does
/// not match the documented format; a broken fixture should fail loudly and
/// immediately, not silently shrink the suite or fail later as a phantom
/// rules divergence.
List<TwinFixtureSuite> loadTwinFixtureSuites(String rootPath) {
  final files =
      Directory(rootPath)
          .listSync(recursive: true)
          .whereType<File>()
          .where((f) => f.path.endsWith('.json'))
          .toList()
        ..sort((a, b) => a.path.compareTo(b.path));
  return [
    for (final file in files)
      parseTwinFixtureSuite(file.path, jsonDecode(file.readAsStringSync())),
  ];
}

/// Validates one fixture file's decoded JSON into a typed suite.
///
/// Exported so a package can lint its fixtures without running them, and so
/// the failure is attributable to a file even when the caller supplies the
/// JSON itself.
TwinFixtureSuite parseTwinFixtureSuite(String path, dynamic json) {
  final root = _object(path, json);
  final cases = _list('$path.cases', root['cases']);
  return TwinFixtureSuite(
    path: path,
    schemaVersion: _int('$path.schemaVersion', root['schemaVersion']),
    cases: [
      for (final (index, raw) in cases.indexed)
        _parseCase('$path.cases[$index]', raw),
    ],
  );
}

TwinFixtureCase _parseCase(String indexed, dynamic raw) {
  final map = _object(indexed, raw);
  // Prefer the case's own name in the location once it is readable: a
  // fixture author finds `cases[3] (seat 0 wins)` faster than an index.
  final name = map['name'];
  final where = name is String ? '$indexed ($name)' : indexed;
  return switch (map['kind']) {
    'action' => _parseActionCase(where, map),
    'playerLimits' => _parsePlayerLimitsCase(where, map),
    'ratingPool' => _parseRatingPoolCase(where, map),
    'botSeatable' => _parseBotSeatableCase(where, map),
    'initialState' => _parseInitialStateCase(where, map),
    'lifecycle' => _parseLifecycleCase(where, map),
    'transcript' => _parseTranscriptCase(where, map),
    'rng' => _parseRngCase(where, map),
    final kind => throw FormatException(
      '$where.kind: expected one of '
      'action | playerLimits | ratingPool | botSeatable | initialState | '
      'lifecycle | transcript | rng, '
      'got ${jsonEncode(kind)}',
    ),
  };
}

ActionCase _parseActionCase(String where, Map<String, dynamic> map) {
  final expected = _object('$where.expected', map['expected']);
  final state = _object('$where.state', map['state']);
  final outcome = expected.containsKey('outcome') && expected['outcome'] != null
      ? _list('$where.expected.outcome', expected['outcome'])
      : null;
  return ActionCase(
    name: _string('$where.name', map['name']),
    config: _object('$where.config', map['config']),
    state: state,
    obs: _optional('$where.obs', map['obs'], _object) ?? state,
    action: _object('$where.action', map['action']),
    pending: _intList('$where.pending', map['pending']),
    playerIndex: _int('$where.playerIndex', map['playerIndex']),
    expectedValid: _bool('$where.expected.valid', expected['valid']),
    expectedObservation: _optional(
      '$where.expected.observation',
      expected['observation'],
      _object,
    ),
    expected: ExpectedEnvelope(
      state: _optional('$where.expected.state', expected['state'], _object),
      pending: _optional(
        '$where.expected.pending',
        expected['pending'],
        _intList,
      ),
      outcome: outcome,
      assertsOutcome: expected.containsKey('outcome'),
    ),
    participantCount:
        _optional('$where.participantCount', map['participantCount'], _int) ??
        2,
    rngSeed:
        _optional('$where.rngSeed', map['rngSeed'], _string) ?? _defaultRngSeed,
  );
}

RatingPoolCase _parseRatingPoolCase(String where, Map<String, dynamic> map) {
  final accessName = _string('$where.access', map['access']);
  final supportedAccess = GameAccess.values.where(
    (access) => access != GameAccess.unknownDefaultOpenApi,
  );
  final access = supportedAccess.asNameMap()[accessName];
  if (access == null) {
    throw FormatException(
      '$where.access: expected one of '
      '${supportedAccess.map((a) => a.name).join(' | ')}, '
      'got ${jsonEncode(accessName)}',
    );
  }
  return RatingPoolCase(
    name: _string('$where.name', map['name']),
    access: access,
    turnSeconds: _optional('$where.turnSeconds', map['turnSeconds'], _int),
    budgetSeconds: _optional(
      '$where.budgetSeconds',
      map['budgetSeconds'],
      _int,
    ),
    incrementSeconds: _optional(
      '$where.incrementSeconds',
      map['incrementSeconds'],
      _int,
    ),
    minPlayers: _int('$where.minPlayers', map['minPlayers']),
    maxPlayers: _int('$where.maxPlayers', map['maxPlayers']),
    config: _object('$where.config', map['config']),
    expected: _optional('$where.expected', map['expected'], _string),
  );
}

PlayerLimitsCase _parsePlayerLimitsCase(
  String where,
  Map<String, dynamic> map,
) {
  final expected = _object('$where.expected', map['expected']);
  return PlayerLimitsCase(
    name: _string('$where.name', map['name']),
    config: _object('$where.config', map['config']),
    expected: PlayerLimits(
      minPlayers: _int('$where.expected.minPlayers', expected['minPlayers']),
      maxPlayers: _int('$where.expected.maxPlayers', expected['maxPlayers']),
    ),
  );
}

BotSeatableCase _parseBotSeatableCase(String where, Map<String, dynamic> map) {
  return BotSeatableCase(
    name: _string('$where.name', map['name']),
    gameConfig: _object('$where.gameConfig', map['gameConfig']),
    botConfig: _object('$where.botConfig', map['botConfig']),
    expected: _bool('$where.expected', map['expected']),
  );
}

/// The envelope block an `initialState`, `lifecycle` or `transcript` case
/// records: every field optional, because a case asserts only what it is about.
final class ExpectedEnvelope {
  const ExpectedEnvelope({
    this.state,
    this.pending,
    this.outcome,
    this.assertsOutcome = false,
  });

  final Map<String, dynamic>? state;
  final List<int>? pending;

  /// The recorded outcome. Null means either "unchecked" or "assert the game is
  /// ongoing", which [assertsOutcome] distinguishes.
  final List<dynamic>? outcome;

  /// Whether the fixture wrote an `outcome` key at all. A written null asserts
  /// the game did not end; an absent one asserts nothing.
  final bool assertsOutcome;
}

/// Exercises [LocalGameRules.initialState] for one config and seat count.
final class InitialStateCase extends TwinFixtureCase {
  const InitialStateCase({
    required super.name,
    required this.config,
    required this.playerCount,
    required this.rngSeed,
    required this.expected,
  });

  final Map<String, dynamic> config;
  final int playerCount;
  final String rngSeed;
  final ExpectedEnvelope expected;
}

/// Exercises [LocalGameRules.applyLifecycle] for one trigger.
final class LifecycleCase extends TwinFixtureCase {
  const LifecycleCase({
    required super.name,
    required this.config,
    required this.state,
    required this.pending,
    required this.action,
    required this.rngSeed,
    required this.expected,
  });

  final Map<String, dynamic> config;
  final Map<String, dynamic> state;
  final List<int> pending;

  /// The engine-constructed payload, already typed.
  final LifecycleAction action;

  final String rngSeed;
  final ExpectedEnvelope expected;
}

/// One move of a [TranscriptCase]: a game action, or a resign.
final class TranscriptTransition {
  const TranscriptTransition({
    required this.isLifecycle,
    required this.playerIndex,
    this.data = const {},
  });

  final bool isLifecycle;
  final int playerIndex;
  final Map<String, dynamic> data;
}

/// A whole game, played move by move through the local kernel.
///
/// The one case kind that exercises the pieces together: the hooks, the guards,
/// the seeded streams, and the version chain. The TypeScript runner drives the
/// real `commit()` over the same file, so a transcript that ends somewhere else
/// here is exactly the divergence an imported game would hit on the server.
final class TranscriptCase extends TwinFixtureCase {
  const TranscriptCase({
    required super.name,
    required this.config,
    required this.playerCount,
    required this.seed,
    required this.transitions,
    required this.expectedVersion,
    required this.expectedStatus,
    required this.expected,
  });

  final Map<String, dynamic> config;
  final int playerCount;
  final String seed;
  final List<TranscriptTransition> transitions;
  final int expectedVersion;

  /// `active` or `finished`, as the fixture recorded it.
  final String expectedStatus;

  final ExpectedEnvelope expected;
}

/// A recorded slice of a deterministic stream.
///
/// The only kind that runs whether or not a version ships a local unit: the
/// streams are engine-owned, and a Dart port that drifts from them by one bit
/// produces a different game on import than the one the player watched.
final class RngCase extends TwinFixtureCase {
  const RngCase({
    required super.name,
    required this.seed,
    required this.version,
    required this.seat,
    required this.draws,
  });

  final String seed;
  final int version;

  /// The bot seat whose stream this is, or null for the transition stream.
  final int? seat;

  final List<double> draws;
}

ExpectedEnvelope _parseExpectedEnvelope(
  String where,
  Map<String, dynamic> map,
) {
  final outcome = map.containsKey('outcome') && map['outcome'] != null
      ? _list('$where.outcome', map['outcome'])
      : null;
  return ExpectedEnvelope(
    state: _optional('$where.state', map['state'], _object),
    pending: _optional('$where.pending', map['pending'], _intList),
    outcome: outcome,
    assertsOutcome: map.containsKey('outcome'),
  );
}

InitialStateCase _parseInitialStateCase(
  String where,
  Map<String, dynamic> map,
) {
  return InitialStateCase(
    name: _string('$where.name', map['name']),
    config: _object('$where.config', map['config']),
    playerCount: _int('$where.playerCount', map['playerCount']),
    rngSeed:
        _optional('$where.rngSeed', map['rngSeed'], _string) ?? _defaultRngSeed,
    expected: _parseExpectedEnvelope(
      '$where.expected',
      _object('$where.expected', map['expected']),
    ),
  );
}

LifecycleCase _parseLifecycleCase(String where, Map<String, dynamic> map) {
  final type = _string('$where.type', map['type']);
  final seat = _optional('$where.playerIndex', map['playerIndex'], _int);
  final LifecycleAction action;
  switch (type) {
    case 'timeout':
      if (seat != null) {
        throw FormatException(
          '$where.playerIndex: a timeout resolves every pending seat and '
          'carries none',
        );
      }
      action = const LifecycleTimeout();
    case 'forfeit':
    case 'autoForfeit':
      if (seat == null) {
        throw FormatException('$where.playerIndex: a $type names its seat');
      }
      action = type == 'forfeit'
          ? LifecycleForfeit(seat)
          : LifecycleAutoForfeit(seat);
    default:
      throw FormatException(
        '$where.type: expected one of timeout | forfeit | autoForfeit, '
        'got ${jsonEncode(type)}',
      );
  }
  _optional('$where.participantCount', map['participantCount'], _int);
  return LifecycleCase(
    name: _string('$where.name', map['name']),
    config: _object('$where.config', map['config']),
    state: _object('$where.state', map['state']),
    pending: _intList('$where.pending', map['pending']),
    action: action,
    rngSeed:
        _optional('$where.rngSeed', map['rngSeed'], _string) ?? _defaultRngSeed,
    expected: _parseExpectedEnvelope(
      '$where.expected',
      _object('$where.expected', map['expected']),
    ),
  );
}

TranscriptCase _parseTranscriptCase(String where, Map<String, dynamic> map) {
  final expected = _object('$where.expected', map['expected']);
  final status = _string('$where.expected.status', expected['status']);
  if (status != 'active' && status != 'finished') {
    throw FormatException(
      '$where.expected.status: expected active | finished, '
      'got ${jsonEncode(status)}',
    );
  }
  return TranscriptCase(
    name: _string('$where.name', map['name']),
    config: _object('$where.config', map['config']),
    playerCount: _int('$where.playerCount', map['playerCount']),
    seed: _string('$where.seed', map['seed']),
    transitions: [
      for (final (index, raw) in _list(
        '$where.transitions',
        map['transitions'],
      ).indexed)
        _parseTranscriptTransition('$where.transitions[$index]', raw),
    ],
    expectedVersion: _int('$where.expected.version', expected['version']),
    expectedStatus: status,
    expected: _parseExpectedEnvelope('$where.expected', expected),
  );
}

TranscriptTransition _parseTranscriptTransition(String where, dynamic raw) {
  final map = _object(where, raw);
  final kind = _string('$where.kind', map['kind']);
  return switch (kind) {
    'game' => TranscriptTransition(
      isLifecycle: false,
      playerIndex: _int('$where.playerIndex', map['playerIndex']),
      data: _object('$where.data', map['data']),
    ),
    'lifecycle' => () {
      final type = _string('$where.type', map['type']);
      if (type != 'forfeit') {
        throw FormatException(
          '$where.type: a transcript can only carry a forfeit, '
          'got ${jsonEncode(type)}',
        );
      }
      return TranscriptTransition(
        isLifecycle: true,
        playerIndex: _int('$where.playerIndex', map['playerIndex']),
      );
    }(),
    _ => throw FormatException(
      '$where.kind: expected game | lifecycle, got ${jsonEncode(kind)}',
    ),
  };
}

RngCase _parseRngCase(String where, Map<String, dynamic> map) {
  final draws = _list('$where.draws', map['draws']);
  if (draws.isEmpty) {
    throw FormatException('$where.draws: expected at least one value');
  }
  return RngCase(
    name: _string('$where.name', map['name']),
    seed: _string('$where.seed', map['seed']),
    version: _int('$where.version', map['version']),
    seat: _optional('$where.seat', map['seat'], _int),
    draws: [
      for (final (index, draw) in draws.indexed)
        _double('$where.draws[$index]', draw),
    ],
  );
}

/// The stream a case draws from when it names none: the TypeScript runner's
/// own default, so a fixture that omits `rngSeed` means the same thing on both
/// sides.
const _defaultRngSeed = 'twin-fixtures';

// ── Field readers ───────────────────────────────────────────────────────────

Never _fail(String where, String expected, dynamic got) =>
    throw FormatException('$where: expected $expected, got ${_describe(got)}');

String _describe(dynamic value) => switch (value) {
  null => 'null',
  final List<dynamic> _ => 'an array',
  final Map<dynamic, dynamic> _ => 'an object',
  final String s => 'the string ${jsonEncode(s)}',
  _ => '$value (${value.runtimeType})',
};

Map<String, dynamic> _object(String where, dynamic v) =>
    v is Map<String, dynamic> ? v : _fail(where, 'an object', v);

List<dynamic> _list(String where, dynamic v) =>
    v is List ? v : _fail(where, 'an array', v);

String _string(String where, dynamic v) =>
    v is String ? v : _fail(where, 'a string', v);

bool _bool(String where, dynamic v) =>
    v is bool ? v : _fail(where, 'a boolean', v);

int _int(String where, dynamic v) => v is int ? v : _fail(where, 'an int', v);

double _double(String where, dynamic v) =>
    v is num ? v.toDouble() : _fail(where, 'a number', v);

List<int> _intList(String where, dynamic v) => [
  for (final (index, n) in _list(where, v).indexed) _int('$where[$index]', n),
];

/// Reads an optional field: absent and explicit null both mean "unspecified".
T? _optional<T>(String where, dynamic v, T Function(String, dynamic) read) =>
    v == null ? null : read(where, v);

// ── Case evaluation ─────────────────────────────────────────────────────────

/// Runs one validated fixture case against the Dart [rules] twin, returning
/// failure descriptions (empty ⇒ the case passes).
///
/// A parse throw (config/observation/action `fromJson`) is reported as a
/// failure, not rethrown: a codec that cannot read the recorded payload is
/// itself twin drift.
List<String> runTwinFixtureCase(
  GameRules<dynamic, dynamic, dynamic> rules,
  TwinFixtureCase fixtureCase,
) => switch (fixtureCase) {
  ActionCase() => _runActionCase(rules, fixtureCase),
  PlayerLimitsCase() => _runPlayerLimitsCase(rules, fixtureCase),
  RatingPoolCase() => _runRatingPoolCase(rules, fixtureCase),
  BotSeatableCase() => _runBotSeatableCase(rules, fixtureCase),
  RngCase() => _runRngCase(fixtureCase),
  InitialStateCase() => _runInitialStateCase(rules, fixtureCase),
  LifecycleCase() => _runLifecycleCase(rules, fixtureCase),
  TranscriptCase() => _runTranscriptCase(rules, fixtureCase),
};

/// The engine's deterministic streams, compared draw for draw.
///
/// Exact equality, with no tolerance: a local game's moves are replayed by the
/// authoritative TypeScript rules when it is imported, so a stream that differs
/// in the last bit produces a different game on the server than the one the
/// player watched. Runs whether or not the version ships a local unit, because
/// the streams are the engine's rather than the game's.
List<String> _runRngCase(RngCase c) {
  final rng = c.seat == null
      ? EigenRng.forTransition(c.seed, c.version)
      : EigenRng.forBot(c.seed, c.seat!, c.version);
  final failures = <String>[];
  for (final (index, expected) in c.draws.indexed) {
    final actual = rng.next();
    if (actual != expected) {
      failures.add(
        'draw $index of the stream for "${c.seed}" at version ${c.version}'
        '${c.seat == null ? '' : ' seat ${c.seat}'} is $actual, '
        'fixture expects $expected',
      );
    }
  }
  return failures;
}

List<String> _runInitialStateCase(
  GameRules<dynamic, dynamic, dynamic> rules,
  InitialStateCase c,
) {
  final local = rules.local;
  if (local == null) return const [];
  final failures = <String>[];
  final config = _parse('config', () => local.parseConfig(c.config), failures);
  if (failures.isNotEmpty) return failures;
  final Envelope<Object?> envelope;
  try {
    envelope = local.initialState(
      config: config,
      rng: EigenRng.forTransition(c.rngSeed, 0),
      playerCount: c.playerCount,
    );
  } on Object catch (error) {
    return ['initialState threw: $error'];
  }
  return _checkEnvelope(local, envelope, c.expected);
}

List<String> _runLifecycleCase(
  GameRules<dynamic, dynamic, dynamic> rules,
  LifecycleCase c,
) {
  final local = rules.local;
  if (local == null) return const [];
  final failures = <String>[];
  final config = _parse('config', () => local.parseConfig(c.config), failures);
  final state = _parse('state', () => local.parseState(c.state), failures);
  if (failures.isNotEmpty) return failures;
  final Envelope<Object?> envelope;
  try {
    envelope = local.applyLifecycle(
      state: state,
      pending: c.pending,
      type: c.action.type,
      data: c.action,
      rng: EigenRng.forSeed(c.rngSeed),
      config: config,
    );
  } on Object catch (error) {
    return ['applyLifecycle threw: $error'];
  }
  final failuresOut = _checkEnvelope(local, envelope, c.expected);
  final seat = c.action.playerIndex;
  if (seat != null && envelope.pendingPlayers.contains(seat)) {
    failuresOut.add(
      'applyLifecycle left the forfeited seat $seat pending; a forfeit must '
      'remove its target seat',
    );
  }
  return failuresOut;
}

/// Replays a whole recorded game through the local kernel.
///
/// The roster convention is the TypeScript runner's, and must stay it: seat 0 is
/// the human `user-0`, every later seat a bot `bot-<i>`. Each move commits at
/// the current version, so a transcript that diverges reports which move did.
List<String> _runTranscriptCase(
  GameRules<dynamic, dynamic, dynamic> rules,
  TranscriptCase c,
) {
  final local = rules.local;
  if (local == null) return const [];
  final roster = [
    for (var seat = 0; seat < c.playerCount; seat++)
      LocalSeat(
        playerIndex: seat,
        userId: seat == 0 ? 'user-0' : null,
        botId: seat == 0 ? null : 'bot-$seat',
        type: seat == 0 ? SeatTypeEnum.human : SeatTypeEnum.bot,
      ),
  ];
  var meta = LocalGameMeta(
    status: GameStatus.ready,
    schemaVersion: 1,
    config: c.config,
    createdBy: 'user-0',
  );
  LocalStateRow? state;
  List<Outcome>? outcomes;

  LocalCommitResult step(LocalIntent intent) => localCommit(
    game: meta,
    state: state,
    roster: roster,
    intent: intent,
    rules: local,
  );

  LocalCommitResult result;
  try {
    result = step(LocalStartIntent(c.seed));
  } on Object catch (error) {
    return ['the start transition threw: $error'];
  }
  if (result case LocalRejected(:final code, :final message)) {
    return ['the start transition was rejected ($code): $message'];
  }
  var plan = result as LocalCommitPlan;
  state = plan.nextState;
  meta = LocalGameMeta(
    status: GameStatus.active,
    schemaVersion: meta.schemaVersion,
    config: meta.config,
    createdBy: meta.createdBy,
  );

  for (final (index, transition) in c.transitions.indexed) {
    final intent = transition.isLifecycle
        ? LocalForfeitIntent(transition.playerIndex)
        : LocalActionIntent(
            seat: transition.playerIndex,
            expectedVersion: state!.version,
            data: transition.data,
            actor: transition.playerIndex == 0
                ? LocalActor.user
                : LocalActor.bot,
          );
    try {
      result = step(intent);
    } on Object catch (error) {
      return ['transitions[$index] threw: $error'];
    }
    if (result case LocalRejected(:final code, :final message)) {
      return ['transitions[$index] was rejected ($code): $message'];
    }
    plan = result as LocalCommitPlan;
    state = plan.nextState;
    outcomes = plan.outcomes;
    if (outcomes != null) {
      meta = LocalGameMeta(
        status: GameStatus.finished,
        schemaVersion: meta.schemaVersion,
        config: meta.config,
        createdBy: meta.createdBy,
      );
    }
  }

  final failures = <String>[];
  if (state!.version != c.expectedVersion) {
    failures.add(
      'the game ended at version ${state.version}, fixture expects '
      '${c.expectedVersion}',
    );
  }
  final status = outcomes == null ? 'active' : 'finished';
  if (status != c.expectedStatus) {
    failures.add('the game ended $status, fixture expects ${c.expectedStatus}');
  }
  failures.addAll(
    _checkEnvelope(
      local,
      Envelope<Object?>(
        state: local.parseState(state.state),
        pendingPlayers: state.pending,
        outcome: outcomes,
      ),
      c.expected,
    ),
  );
  return failures;
}

/// Compares one hook's envelope against what a fixture recorded.
List<String> _checkEnvelope(
  LocalGameRules<dynamic, dynamic, dynamic, dynamic> local,
  Envelope<Object?> envelope,
  ExpectedEnvelope expected,
) {
  final failures = <String>[];
  final state = expected.state;
  if (state != null) {
    final actual = local.serializeState(envelope.state);
    if (!jsonEquals(actual, state)) {
      failures.add(
        'state is ${jsonEncode(actual)}, fixture expects ${jsonEncode(state)}',
      );
    }
  }
  final pending = expected.pending;
  if (pending != null && !_deepEquals(envelope.pendingPlayers, pending)) {
    failures.add(
      'pending is ${jsonEncode(envelope.pendingPlayers)}, fixture expects '
      '${jsonEncode(pending)}',
    );
  }
  if (expected.assertsOutcome) {
    final actual = envelope.outcome;
    final recorded = expected.outcome;
    if (recorded == null && actual != null) {
      failures.add('the game ended, fixture expects it to be ongoing');
    } else if (recorded != null && actual == null) {
      failures.add('the game is ongoing, fixture expects it to have ended');
    } else if (recorded != null && actual != null) {
      final encoded = [for (final outcome in actual) outcome.toJson()];
      if (!jsonEquals(encoded, recorded)) {
        failures.add(
          'outcome is ${jsonEncode(encoded)}, fixture expects '
          '${jsonEncode(recorded)}',
        );
      }
    }
  }
  return failures;
}

List<String> _runActionCase(
  GameRules<dynamic, dynamic, dynamic> rules,
  ActionCase c,
) {
  final failures = <String>[];
  final config = _parse('config', () => rules.parseConfig(c.config), failures);
  final obs = _parse(
    'observation',
    () => rules.parseObservation(c.obs),
    failures,
  );
  final action = _parse('action', () => rules.parseAction(c.action), failures);
  if (failures.isNotEmpty) return failures;

  // The codec must round-trip the fixture action: what parseAction reads,
  // serializeAction must write back, or else a submitted move would not
  // match what the TS side validated this fixture against.
  final roundTrip = rules.serializeAction(action);
  if (!_deepEquals(roundTrip, c.action)) {
    failures.add(
      'action codec does not round-trip the fixture action: '
      'serializeAction produced ${jsonEncode(roundTrip)}',
    );
  }

  final valid = rules.isValidAction(
    obs: obs,
    pending: c.pending,
    data: action,
    playerIndex: c.playerIndex,
    config: config,
  );
  if (valid != c.expectedValid) {
    failures.add(
      'isValidAction returned $valid, fixture expects ${c.expectedValid}',
    );
    return failures;
  }
  if (c.expectedValid && c.expectedObservation != null) {
    _checkPreview(rules, c, obs, action, config, failures);
  }
  failures.addAll(_checkLocalAction(rules, c));
  return failures;
}

/// Runs the same case through the on-device unit, which is the half that
/// actually commits when the game is played offline.
///
/// Everything above this exercises the optimism hooks on [GameRules]:
/// `isValidAction` and `previewAction`, which decide what the screen may show
/// before the server answers. They are not the rules. `applyAction` is, and on
/// a device it is the Dart one — so without this the whole action corpus could
/// pass against a local unit that computes a different board, or hands a seat
/// its opponent's hidden commit, which is the failure that matters most for a
/// hidden-information game and exactly what `expected.observation` pins.
List<String> _checkLocalAction(
  GameRules<dynamic, dynamic, dynamic> rules,
  ActionCase c,
) {
  final local = rules.local;
  if (local == null) return const [];
  final failures = <String>[];
  final config = _parse('config', () => local.parseConfig(c.config), failures);
  final state = _parse('state', () => local.parseState(c.state), failures);
  final action = _parse('action', () => local.parseAction(c.action), failures);
  if (failures.isNotEmpty) return failures;

  final Envelope<Object?> envelope;
  try {
    envelope = local.applyAction(
      state: state,
      pending: c.pending,
      data: action,
      playerIndex: c.playerIndex,
      rng: EigenRng.forSeed(c.rngSeed),
      config: config,
    );
  } on IllegalMoveException catch (error) {
    // Refusing a move the fixture calls legal is drift; refusing one it calls
    // illegal is the unit agreeing, and there is no envelope left to check.
    return c.expectedValid
        ? ['applyAction rejected a move the fixture expects to be valid: $error']
        : const [];
  } on Object catch (error) {
    return ['applyAction threw a non-IllegalMoveException: $error'];
  }
  if (!c.expectedValid) {
    return ['applyAction accepted a move the fixture expects to be illegal'];
  }
  failures.addAll(_checkEnvelope(local, envelope, c.expected));

  final expectedObservation = c.expectedObservation;
  if (expectedObservation == null) return failures;
  final ObservationSlice<Object?> slice;
  try {
    slice = local.computeObservation(
      state: envelope.state,
      pending: envelope.pendingPlayers,
      playerIndex: c.playerIndex,
      participantCount: c.participantCount,
      config: config,
      cause: local.retypeCause(
        GameCause<Object?>(data: action, playerIndex: c.playerIndex),
      ),
      isReplay: false,
    );
  } on Object catch (error) {
    failures.add('computeObservation threw: $error');
    return failures;
  }
  final actual = local.serializeObservation(slice.data);
  // Value equality, not document equality: the fixture was written by the
  // TypeScript codec and this by the Dart one, and a field the schema marks
  // optional and nullable may be written as null by one and left out by the
  // other. Both are the same observation; see [jsonEquals].
  if (!jsonEquals(actual, expectedObservation)) {
    failures.add(
      "the actor's observation is ${jsonEncode(actual)}, fixture expects "
      '${jsonEncode(expectedObservation)}',
    );
  }
  return failures;
}

/// Compares [GameRules.previewAction] against `expected.observation`, but
/// only when the game implements optimism (a null preview means "this move is
/// server-driven", which is always a correct answer, never drift).
void _checkPreview(
  GameRules<dynamic, dynamic, dynamic> rules,
  ActionCase c,
  dynamic obs,
  dynamic action,
  dynamic config,
  List<String> failures,
) {
  final preview = rules.previewAction(
    obs: obs,
    pending: c.pending,
    data: action,
    playerIndex: c.playerIndex,
    config: config,
  );
  if (preview == null) return;
  final expectedObs = _parse(
    'expected.observation',
    () => rules.parseObservation(c.expectedObservation!),
    failures,
  );
  if (failures.isNotEmpty) return;
  if (preview != expectedObs) {
    failures.add(
      'previewAction diverges from the expected observation '
      '(got $preview, expected $expectedObs)',
    );
  }
}

List<String> _runRatingPoolCase(
  GameRules<dynamic, dynamic, dynamic> rules,
  RatingPoolCase c,
) {
  final pool = rules.ratingPool(
    RatingPoolArgs(
      access: c.access,
      turnSeconds: c.turnSeconds,
      budgetSeconds: c.budgetSeconds,
      incrementSeconds: c.incrementSeconds,
      minPlayers: c.minPlayers,
      maxPlayers: c.maxPlayers,
      config: c.config,
    ),
  );
  if (pool == c.expected) return const [];
  return [
    'ratingPool returned ${jsonEncode(pool)}, fixture expects '
        '${jsonEncode(c.expected)}',
  ];
}

List<String> _runPlayerLimitsCase(
  GameRules<dynamic, dynamic, dynamic> rules,
  PlayerLimitsCase c,
) {
  final failures = <String>[];
  final config = _parse('config', () => rules.parseConfig(c.config), failures);
  if (config == null) return failures;
  final limits = rules.playerLimits(config);
  if (limits == c.expected) return const [];
  return [
    'playerLimits returned ${limits.minPlayers}-${limits.maxPlayers}, '
        'fixture expects ${c.expected.minPlayers}-${c.expected.maxPlayers}',
  ];
}

List<String> _runBotSeatableCase(
  GameRules<dynamic, dynamic, dynamic> rules,
  BotSeatableCase c,
) {
  final seatable = rules.botSeatable(
    BotSeatableArgs(gameConfig: c.gameConfig, botConfig: c.botConfig),
  );
  if (seatable == c.expected) return const [];
  return ['botSeatable returned $seatable, fixture expects ${c.expected}'];
}

/// Runs one codec step, converting a throw into a recorded failure.
T? _parse<T>(String what, T Function() parse, List<String> failures) {
  try {
    return parse();
  } catch (error) {
    failures.add('Dart codec failed to parse the fixture $what: $error');
    return null;
  }
}

/// Structural JSON equality: maps compare by key set, lists in order.
bool _deepEquals(dynamic a, dynamic b) {
  if (a is Map && b is Map) {
    if (a.length != b.length) return false;
    return a.keys.every((k) => b.containsKey(k) && _deepEquals(a[k], b[k]));
  }
  if (a is List && b is List) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (!_deepEquals(a[i], b[i])) return false;
    }
    return true;
  }
  return a == b;
}
