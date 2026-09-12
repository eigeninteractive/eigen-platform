import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

import 'counter_game.dart';

/// A unit that always opens on seat 0, so a test can pin the roster without
/// depending on which seat the opening draw chose.
final class SeatZeroRules extends CounterRules {
  const SeatZeroRules();

  @override
  Envelope<CounterState> initialState({
    required CounterConfig config,
    required Rng rng,
    required int playerCount,
  }) => Envelope(
    state: CounterState(scores: List<int>.filled(playerCount, 0), turn: 0),
    pendingPlayers: const [0],
  );
}

const _seed = '0123456789abcdef0123456789abcdef';

LocalGameMeta _meta({
  GameStatus status = GameStatus.ready,
  Map<String, dynamic> config = const {'target': 5},
}) => LocalGameMeta(
  status: status,
  schemaVersion: 1,
  config: config,
  createdBy: 'user-1',
);

/// Runs the start intent and returns the plan, failing the test on a rejection.
LocalCommitPlan _start({
  AnyLocalGameRules rules = const CounterRules(),
  List<LocalSeat>? roster,
}) {
  final result = localCommit(
    game: _meta(),
    state: null,
    roster: roster ?? counterRoster(),
    intent: const LocalStartIntent(_seed),
    rules: rules,
  );
  return result as LocalCommitPlan;
}

void main() {
  group('start', () {
    test('commits version 0 from the version-0 stream', () {
      final plan = _start();

      expect(plan.nextState.version, 0);
      expect(plan.nextState.rngSeed, _seed);
      expect(plan.action, isNull);
      expect(plan.outcomes, isNull);
      expect(plan.nextState.state['scores'], [0, 0]);
      // `initialState` draws once; the seat it picked is the one the kernel's
      // own `EigenRng.forTransition(seed, 0)` produces.
      final expected =
          (EigenRng.forTransition(_seed, 0).next() * 2).floor() % 2;
      expect(plan.nextState.state['turn'], expected);
      expect(plan.nextState.pending, [expected]);
    });

    test('projects one frame per identified seat', () {
      final plan = _start(rules: const SeatZeroRules());

      expect(plan.frames.map((frame) => frame.playerIndex), [0, 1]);
      expect(plan.frames.first.data['scores'], [0, 0]);
      expect(plan.frames.first.pendingPlayers, [0]);
      // Nothing produced the opening state, so there is no cue to render.
      expect(plan.frames.first.data['lastStep'], isNull);
    });

    test('skips a seat nobody holds', () {
      final plan = _start(
        rules: const SeatZeroRules(),
        roster: const [
          LocalSeat(
            playerIndex: 0,
            userId: 'user-1',
            botId: null,
            type: SeatTypeEnum.human,
          ),
          LocalSeat(
            playerIndex: 1,
            userId: null,
            botId: null,
            type: SeatTypeEnum.human,
          ),
        ],
      );

      expect(plan.frames.map((frame) => frame.playerIndex), [0]);
    });

    test('wakes a pending bot seat and nothing else', () {
      final plan = _start(rules: const SeatZeroRules());
      expect(plan.effects, isEmpty);

      final botFirst = localCommit(
        game: _meta(),
        state: null,
        roster: counterRoster(),
        intent: const LocalStartIntent('seed-that-opens-on-one'),
        rules: const _SeatOneRules(),
      );
      final effects = (botFirst as LocalCommitPlan).effects;
      expect(effects, hasLength(1));
      expect((effects.single as LocalWakeBot).seat, 1);
      expect((effects.single as LocalWakeBot).botId, 'bot-1');
    });

    test('abstains when the game is already running', () {
      final result = localCommit(
        game: _meta(status: GameStatus.active),
        state: null,
        roster: counterRoster(),
        intent: const LocalStartIntent(_seed),
        rules: const CounterRules(),
      );

      expect((result as LocalRejected).code, LocalRejectCode.abstain);
    });

    test('refuses a game that is not ready', () {
      final result = localCommit(
        game: _meta(status: GameStatus.waiting),
        state: null,
        roster: counterRoster(),
        intent: const LocalStartIntent(_seed),
        rules: const CounterRules(),
      );

      expect((result as LocalRejected).code, LocalRejectCode.notReady);
    });

    test('treats an empty seed as a bug', () {
      expect(
        () => localCommit(
          game: _meta(),
          state: null,
          roster: counterRoster(),
          intent: const LocalStartIntent(''),
          rules: const CounterRules(),
        ),
        throwsA(isA<LocalGameBugError>()),
      );
    });

    test('treats an unreadable stored config as a bug', () {
      expect(
        () => localCommit(
          game: _meta(config: const {'target': 'five'}),
          state: null,
          roster: counterRoster(),
          intent: const LocalStartIntent(_seed),
          rules: const CounterRules(),
        ),
        throwsA(isA<LocalGameBugError>()),
      );
    });
  });

  group('action', () {
    late LocalStateRow opening;

    setUp(() => opening = _start(rules: const SeatZeroRules()).nextState);

    LocalCommitResult act({
      int seat = 0,
      int? expectedVersion,
      Map<String, dynamic> data = const {'step': 2},
      GameStatus status = GameStatus.active,
      LocalActor actor = LocalActor.user,
      AnyLocalGameRules rules = const SeatZeroRules(),
    }) => localCommit(
      game: _meta(status: status),
      state: opening,
      roster: counterRoster(),
      intent: LocalActionIntent(
        seat: seat,
        expectedVersion: expectedVersion ?? opening.version,
        data: data,
        actor: actor,
      ),
      rules: rules,
    );

    test('commits the next version and logs the sanitized payload', () {
      final plan = act() as LocalCommitPlan;

      expect(plan.nextState.version, 1);
      expect(plan.nextState.state['scores'], [2, 0]);
      expect(plan.nextState.pending, [1]);
      expect(plan.action!.type, LocalActionType.user);
      expect(plan.action!.kind, LocalActionKind.game);
      expect(plan.action!.playerIndex, 0);
      expect(plan.action!.data, {'step': 2});
      // The cause reached `computeObservation`, which is how a game animates.
      expect(plan.frames.first.data['lastStep'], 2);
      expect((plan.effects.single as LocalWakeBot).seat, 1);
    });

    test('records a brain move as a bot action', () {
      final plan = act(actor: LocalActor.bot) as LocalCommitPlan;
      expect(plan.action!.type, LocalActionType.bot);
    });

    test('refuses a move the rules call illegal', () {
      final result = act(data: const {'step': 9}) as LocalRejected;

      expect(result.code, LocalRejectCode.illegalMove);
      expect(result.message, 'Step must be 1, 2 or 3');
      expect(result.code.errorCode, ErrorCode.illegalMove);
    });

    test('refuses a payload the codec cannot read', () {
      final result = act(data: const {'step': 'two'}) as LocalRejected;

      expect(result.code, LocalRejectCode.invalidPayload);
      expect(result.code.errorCode, ErrorCode.invalidPayload);
    });

    test('refuses a stale or ahead expected version', () {
      expect(
        (act(expectedVersion: -1) as LocalRejected).code,
        LocalRejectCode.stateUpdated,
      );
      expect(
        (act(expectedVersion: 7) as LocalRejected).code,
        LocalRejectCode.stateUpdated,
      );
    });

    test('refuses a seat that is not pending', () {
      expect((act(seat: 1) as LocalRejected).code, LocalRejectCode.notPending);
    });

    test('refuses a game that is not active', () {
      expect(
        (act(status: GameStatus.finished) as LocalRejected).code,
        LocalRejectCode.notActive,
      );
    });

    test('ends the game with validated outcomes and no wakes', () {
      final reached = LocalStateRow(
        version: 3,
        state: const {
          'scores': [4, 0],
          'turn': 0,
        },
        pending: const [0],
        rngSeed: _seed,
      );
      final plan =
          localCommit(
                game: _meta(status: GameStatus.active),
                state: reached,
                roster: counterRoster(),
                intent: const LocalActionIntent(
                  seat: 0,
                  expectedVersion: 3,
                  data: {'step': 1},
                  actor: LocalActor.user,
                ),
                rules: const CounterRules(),
              )
              as LocalCommitPlan;

      expect(plan.nextState.version, 4);
      expect(plan.nextState.pending, isEmpty);
      expect(plan.outcomes, hasLength(2));
      expect(plan.outcomes!.first.result, OutcomeResultEnum.win);
      expect(plan.effects, isEmpty);
    });

    test('treats a malformed outcome as a bug', () {
      expect(
        () => act(rules: const StrayOutcomeRules()),
        throwsA(isA<LocalGameBugError>()),
      );
      expect(
        () => act(rules: const EmptyOutcomeRules()),
        throwsA(isA<LocalGameBugError>()),
      );
    });

    test('treats a state its own codec rejects as a bug', () {
      expect(
        () => act(rules: const UnparseableStateRules()),
        throwsA(isA<LocalGameBugError>()),
      );
    });

    test('treats a lying projection as a bug', () {
      expect(
        () => act(rules: const LyingObservationRules()),
        throwsA(isA<LocalGameBugError>()),
      );
    });
  });

  group('forfeit', () {
    test('resolves the game and logs a lifecycle action', () {
      final opening = _start(rules: const SeatZeroRules()).nextState;
      final plan =
          localCommit(
                game: _meta(status: GameStatus.active),
                state: opening,
                roster: counterRoster(),
                intent: const LocalForfeitIntent(0),
                rules: const CounterRules(),
              )
              as LocalCommitPlan;

      expect(plan.nextState.pending, isEmpty);
      expect(plan.action!.kind, LocalActionKind.lifecycle);
      expect(plan.action!.type, LocalActionType.user);
      expect(plan.action!.playerIndex, 0);
      expect(plan.action!.data, {'type': 'forfeit', 'playerIndex': 0});
      expect(plan.outcomes!.first.result, OutcomeResultEnum.loss);
    });

    test('refuses a game that is not active', () {
      final opening = _start(rules: const SeatZeroRules()).nextState;
      final result = localCommit(
        game: _meta(status: GameStatus.finished),
        state: opening,
        roster: counterRoster(),
        intent: const LocalForfeitIntent(0),
        rules: const CounterRules(),
      );

      expect((result as LocalRejected).code, LocalRejectCode.notActive);
    });

    test('treats a hook that keeps the seat pending as a bug', () {
      final opening = _start(rules: const SeatZeroRules()).nextState;

      expect(
        () => localCommit(
          game: _meta(status: GameStatus.active),
          state: opening,
          roster: counterRoster(),
          intent: const LocalForfeitIntent(0),
          rules: const StickyForfeitRules(),
        ),
        throwsA(isA<LocalGameBugError>()),
      );
    });
  });

  test('a pending seat nobody holds is a bug', () {
    expect(
      () => _start(rules: const GhostPendingRules()),
      throwsA(isA<LocalGameBugError>()),
    );
  });

  test('lifecycle payloads round-trip through their TypeScript shapes', () {
    for (final action in <LifecycleAction>[
      const LifecycleTimeout(),
      const LifecycleForfeit(1),
      const LifecycleAutoForfeit(2),
    ]) {
      final json = action.toJson();
      final parsed = LifecycleAction.fromJson(json);
      expect(parsed.type, action.type);
      expect(parsed.playerIndex, action.playerIndex);
      expect(json['type'], action.type.wire);
    }
    expect(const LifecycleTimeout().toJson(), {'type': 'timeout'});
    expect(const LifecycleForfeit(1).toJson(), {
      'type': 'forfeit',
      'playerIndex': 1,
    });
  });
}

/// A unit that opens on the bot seat, for the wake effect.
final class _SeatOneRules extends CounterRules {
  const _SeatOneRules();

  @override
  Envelope<CounterState> initialState({
    required CounterConfig config,
    required Rng rng,
    required int playerCount,
  }) => Envelope(
    state: CounterState(scores: List<int>.filled(playerCount, 0), turn: 1),
    pendingPlayers: const [1],
  );
}
