import 'package:checks/checks.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

import 'counter_game.dart';

Session _session({
  required int version,
  String status = 'active',
  List<Outcome>? outcomes,
}) => Session.fromJson({
  'type': 'session',
  'seq': version + 1,
  'gameId': 'game-1',
  'shortCode': '',
  'access': 'private',
  'origin': 'local',
  'schemaVersion': 1,
  'config': <String, dynamic>{'target': 10},
  'turnSeconds': null,
  'budgetSeconds': null,
  'incrementSeconds': null,
  'rated': false,
  'ratingPool': null,
  'minPlayers': 2,
  'maxPlayers': 2,
  'createdBy': 'user-a',
  'status': status,
  'players': <Map<String, dynamic>>[
    {'playerIndex': 0, 'userId': 'user-a', 'botId': null, 'type': 'human'},
    {'playerIndex': 1, 'userId': null, 'botId': 'bot-1', 'type': 'bot'},
  ],
  'version': version,
  'frame': {
    'type': 'frame',
    'version': version,
    'data': <String, dynamic>{
      'scores': <int>[version, 0],
      'turn': version.isEven ? 0 : 1,
      'lastStep': version == 0 ? null : 1,
    },
    'pendingPlayers': <int>[version.isEven ? 0 : 1],
    'deadline': null,
    'playerTimes': null,
    if (outcomes != null)
      'outcomes': [for (final outcome in outcomes) outcome.toJson()],
  },
});

LocalTransitionRow _row(int version) => LocalTransitionRow(
  version: version,
  state: {
    'scores': <int>[version, 0],
    'turn': version.isEven ? 0 : 1,
  },
  action: version == 0
      ? null
      : TransitionAction(
          type: version.isOdd
              ? TransitionActionTypeEnum.user
              : TransitionActionTypeEnum.bot,
          kind: TransitionActionKindEnum.game,
          data: const {'step': 1},
          playerIndex: version.isOdd ? 0 : 1,
        ),
  pending: [version.isEven ? 0 : 1],
);

LocalRecord _remote({int upTo = 2, int? finishedAt}) => LocalRecord(
  session: _session(version: upTo),
  seed: 'b' * 32,
  createdAt: DateTime.utc(2026, 9, 1).millisecondsSinceEpoch,
  finishedAt: finishedAt,
  transitions: [for (var v = 0; v <= upTo; v++) _row(v)],
);

void main() {
  const rules = CounterRules();

  test('rebuilds a playable record from the server copy', () {
    final record = localRecordFromRemote(remote: _remote(), rules: rules);

    check(record.id).equals('game-1');
    check(record.createdBy).equals('user-a');
    check(record.seed).equals('b' * 32);
    check(record.schemaVersion).equals(1);
    check(record.roster.length).equals(2);
    check(record.roster[1].botId).equals('bot-1');
    check(record.transitions.map((t) => t.version)).deepEquals([0, 1, 2]);
    check(record.version).equals(2);
    check(record.createdAt).equals(DateTime.utc(2026, 9, 1));
  });

  test('arrives already synchronized, because the server is where it came '
      'from', () {
    final record = localRecordFromRemote(remote: _remote(), rules: rules);

    check(record.remoteCreated).isTrue();
    check(record.syncedVersion).equals(2);
    check(record.diverged).isFalse();
  });

  test('re-projects every seat\'s frame rather than trusting a transferred '
      'copy', () {
    final record = localRecordFromRemote(remote: _remote(), rules: rules);

    for (var version = 0; version <= 2; version++) {
      // Both seats, at every version: the engine needs the bot's own view to
      // run its brain, and replay needs the human's.
      check(record.frameFor(seat: 0, version: version)).isNotNull();
      check(record.frameFor(seat: 1, version: version)).isNotNull();
    }
    final projected = record.frameFor(seat: 0, version: 2)!.data;
    check((projected['scores'] as List).first).equals(2);
    // The cue the projection embeds comes from the logged action, which is
    // what proves the frame was re-derived rather than copied.
    check(projected['lastStep']).equals(1);
  });

  test('logs a bot move as a bot move, so a resumed game replays the same', () {
    final record = localRecordFromRemote(remote: _remote(), rules: rules);

    check(record.transitions[0].action).isNull();
    check(record.transitions[1].action!.type).equals(LocalActionType.user);
    check(record.transitions[2].action!.type).equals(LocalActionType.bot);
  });

  test('carries a finished game\'s outcomes and finish time', () {
    final finishedAt = DateTime.utc(2026, 9, 2).millisecondsSinceEpoch;
    final remote = LocalRecord(
      session: _session(
        version: 2,
        status: 'finished',
        outcomes: [
          Outcome(
            playerIndex: 0,
            result: OutcomeResultEnum.win,
            placement: 1,
            teamIndex: 0,
          ),
          Outcome(
            playerIndex: 1,
            result: OutcomeResultEnum.loss,
            placement: 2,
            teamIndex: 1,
          ),
        ],
      ),
      seed: 'b' * 32,
      createdAt: DateTime.utc(2026, 9, 1).millisecondsSinceEpoch,
      finishedAt: finishedAt,
      transitions: [for (var v = 0; v <= 2; v++) _row(v)],
    );

    final record = localRecordFromRemote(remote: remote, rules: rules);

    check(record.status).equals(GameStatus.finished);
    check(record.isTerminal).isTrue();
    check(record.outcomes).isNotNull();
    check(record.outcomes!.first.result).equals(OutcomeResultEnum.win);
    check(record.finishedAt).equals(DateTime.utc(2026, 9, 2));
  });

  test('refuses a ratings transition, which a local game cannot have', () {
    final remote = LocalRecord(
      session: _session(version: 1),
      seed: 'b' * 32,
      createdAt: DateTime.utc(2026, 9, 1).millisecondsSinceEpoch,
      finishedAt: null,
      transitions: [
        _row(0),
        LocalTransitionRow(
          version: 1,
          state: const {
            'scores': <int>[1, 0],
            'turn': 1,
          },
          action: TransitionAction(
            type: TransitionActionTypeEnum.system,
            kind: TransitionActionKindEnum.ratings,
            data: const {'deltas': <Object?>[]},
            playerIndex: null,
          ),
          pending: const [],
        ),
      ],
    );

    check(
      () => localRecordFromRemote(remote: remote, rules: rules),
    ).throws<FormatException>();
  });

  test('refuses a log that stops short of the session\'s own version', () {
    // What a caller that ignored the record route's paging would hand over: the
    // session says 2, the log carries only the first two versions.
    final truncated = LocalRecord(
      session: _session(version: 2),
      seed: 'b' * 32,
      createdAt: DateTime.utc(2026, 9, 1).millisecondsSinceEpoch,
      finishedAt: null,
      transitions: [_row(0), _row(1)],
    );

    check(
      () => localRecordFromRemote(remote: truncated, rules: rules),
    ).throws<FormatException>();
  });

  test('refuses a log with a hole in it', () {
    final holed = LocalRecord(
      session: _session(version: 2),
      seed: 'b' * 32,
      createdAt: DateTime.utc(2026, 9, 1).millisecondsSinceEpoch,
      finishedAt: null,
      transitions: [_row(0), _row(2), _row(2)],
    );

    check(
      () => localRecordFromRemote(remote: holed, rules: rules),
    ).throws<FormatException>();
  });

  test('a rebuilt record round-trips through the store\'s JSON', () {
    final record = localRecordFromRemote(remote: _remote(), rules: rules);
    final restored = LocalGameRecord.fromJson(record.toJson());

    check(restored.seed).equals(record.seed);
    check(restored.syncedVersion).equals(record.syncedVersion);
    check(restored.transitions.length).equals(record.transitions.length);
    check(restored.frameFor(seat: 1, version: 2)).isNotNull();
  });
}
