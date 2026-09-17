import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

import '../local/counter_game.dart';
import 'memory_replica.dart';
import 'wire_fixtures.dart';

final _now = DateTime.utc(2026, 9, 16);

void main() {
  late ReplicaDatabase db;
  late AccountReplica replica;

  setUp(() {
    db = memoryReplica();
    replica = AccountReplica(db, me);
  });

  group('a sync', () {
    test('states the profile, ratings, friends and requests', () async {
      await replica.applySync(
        accountSync(
          ratings: [
            {
              'pool': 'pool',
              'mu': 25,
              'sigma': 8,
              'displayRating': 120,
              'updatedAt': 9,
            },
          ],
          friends: [friendJson(them)],
          requests: [friendJson('user-c', direction: 'incoming')],
        ),
        first: true,
        endedSeen: const {},
        pulledAt: _now,
      );

      final profile = (await replica.watchProfile().first)!;
      expect(profile.id, me);
      expect(profile.email, 'a@example.test');
      expect(profile.avatarUrl, isNull);
      expect((await replica.watchRatings().first).single.displayRating, 120);
      expect((await replica.watchFriends().first).single.userId, them);
      final request = (await replica.watchFriendRequests().first).single;
      expect(request.userId, 'user-c');
      expect(request.direction, FriendRequestDirectionEnum.incoming);
      expect((await replica.watchHistory().first).lastSyncedAt, _now);
    });

    test(
      'replaces the small sets whole, so a removed friend is gone',
      () async {
        await replica.applySync(
          accountSync(friends: [friendJson(them)]),
          first: true,
          endedSeen: const {},
          pulledAt: _now,
        );
        await replica.applySync(
          accountSync(),
          first: false,
          endedSeen: const {},
          pulledAt: _now,
        );
        expect(await replica.watchFriends().first, isEmpty);
      },
    );

    test('lists games in play with the account\'s turn first', () async {
      await replica.applySync(
        accountSync(
          active: [
            summaryJson(
              id: 'waiting-on-them',
              seq: 3,
              pending: [1],
              updatedAt: 9,
            ),
            summaryJson(id: 'my-turn', seq: 3, pending: [0], updatedAt: 1),
          ],
        ),
        first: true,
        endedSeen: const {},
        pulledAt: _now,
      );
      final active = await replica.watchActiveGames().first;
      expect(active.map((game) => game.id), ['my-turn', 'waiting-on-them']);
      expect(active.first.participants, hasLength(2));
    });

    test('removes a game in play the account left, but only on the pass\'s '
        'last page', () async {
      await replica.applySync(
        accountSync(active: [summaryJson(id: 'left', seq: 2)]),
        first: true,
        endedSeen: const {},
        pulledAt: _now,
      );

      // A middle page: the game may yet arrive as ended on a later one.
      await replica.applySync(
        accountSync(hasMore: true),
        first: false,
        endedSeen: null,
        pulledAt: _now,
      );
      expect(await replica.watchActiveGames().first, hasLength(1));

      await replica.applySync(
        accountSync(),
        first: false,
        endedSeen: const {},
        pulledAt: _now,
      );
      expect(await replica.watchActiveGames().first, isEmpty);
    });

    test('is only as current as its last completed pass', () async {
      final earlier = _now.subtract(const Duration(minutes: 5));
      await replica.applySync(
        accountSync(),
        first: true,
        endedSeen: const {},
        pulledAt: earlier,
      );

      // A pass still paging has not completed, however recent its first page.
      await replica.applySync(
        accountSync(hasMore: true),
        first: false,
        endedSeen: null,
        pulledAt: _now,
      );
      expect(await replica.lastSyncedAt(), earlier);

      await replica.applySync(
        accountSync(),
        first: false,
        endedSeen: const {},
        pulledAt: _now,
      );
      expect(await replica.lastSyncedAt(), _now);
    });

    test('an ended game moves from in play to history', () async {
      await replica.applySync(
        accountSync(active: [summaryJson(id: 'g', seq: 2)]),
        first: true,
        endedSeen: const {},
        pulledAt: _now,
      );
      await replica.applySync(
        accountSync(
          finished: [
            summaryJson(
              id: 'g',
              seq: 5,
              status: 'finished',
              finishedAt: 2000,
              ratings: [
                {
                  'identity': {'userId': me, 'botId': null},
                  'pool': 'pool',
                  'muBefore': 25,
                  'sigmaBefore': 8,
                  'displayBefore': 0,
                  'muAfter': 27,
                  'sigmaAfter': 7,
                  'displayAfter': 40,
                  'displayChange': 40,
                },
              ],
            ),
          ],
          cursor: 1,
        ),
        first: false,
        endedSeen: const {'g'},
        pulledAt: _now,
      );
      expect(await replica.watchActiveGames().first, isEmpty);
      final finished = await replica.watchFinishedGames(limit: 10).first;
      expect(finished.single.status, GameStatus.finished);
      expect(finished.single.ratings!.single.displayChange, 40);
      expect(await replica.finishedCursor(), 1);
    });

    test(
      'keeps the history floor a first sync set until backfill moves it',
      () async {
        await replica.applySync(
          accountSync(floor: 'older', cursor: 3),
          first: true,
          endedSeen: const {},
          pulledAt: _now,
        );
        expect((await replica.watchHistory().first).hasOlder, isTrue);

        await replica.applySync(
          accountSync(cursor: 4),
          first: false,
          endedSeen: const {},
          pulledAt: _now,
        );
        expect(await replica.historyFloor(), 'older');

        await replica.applyOlderHistory((
          games: [
            summary(id: 'old', seq: 3, status: 'finished', finishedAt: 1),
          ],
          nextCursor: null,
        ));
        expect(await replica.historyFloor(), isNull);
        expect((await replica.watchHistory().first).hasOlder, isFalse);
        expect(await replica.watchFinishedGames(limit: 10).first, hasLength(1));
      },
    );
  });

  group('revision ordering', () {
    test('an older summary changes nothing, from any source', () async {
      await replica.applySummary(summary(id: 'g', seq: 5, pending: [1]));
      await replica.applySummary(
        summary(
          id: 'g',
          seq: 4,
          pending: [0],
          participants: [seatJson(0, userId: me)],
        ),
      );
      final game = (await replica.watchActiveGames().first).single;
      expect(game.seq, 5);
      expect(game.pendingPlayers, [1]);
      expect(game.participants, hasLength(2));
    });

    test('a live session and a summary order by the same revision', () async {
      await replica.applySession(session(seq: 7, version: 6), now: _now);
      await replica.applySummary(summary(id: 'g', seq: 6, status: 'waiting'));
      expect((await replica.coldSession('g'))!.status, GameStatus.active);

      await replica.applySummary(
        summary(id: 'g', seq: 8, status: 'finished', finishedAt: 5),
      );
      final cold = (await replica.coldSession('g'))!;
      expect(cold.status, GameStatus.finished);
      // A summary carries no board, so the frame is still the one served live.
      expect(cold.frame!.version, 6);
    });

    test('a recovered gap frame is stored beside an older header', () async {
      await replica.applySession(session(seq: 9, version: 8), now: _now);
      await replica.applySession(
        session(seq: 4, version: 3),
        frame: Frame.fromJson(frameJson(7)),
        now: _now,
      );
      final cold = (await replica.coldSession('g'))!;
      expect(cold.seq, 9);
      expect(cold.frame!.version, 8);
    });

    test(
      'a game this device decides is never overwritten by a copy of it',
      () async {
        final engine = await LocalGameEngine.create(
          userId: me,
          schemaVersion: 1,
          config: const {'target': 5},
          botIds: const ['bot-1'],
          bots: {'bot-1': counterBot()},
          rules: const CounterRules(),
          storage: LocalGameStorage(db),
          newGameId: () => 'local-1',
        );
        await engine.close();

        await replica.applySummary(
          summary(id: 'local-1', seq: 99, status: 'aborted', origin: 'local'),
        );
        await replica.applySession(
          session(gameId: 'local-1', seq: 99, status: 'aborted', version: 0),
          now: _now,
        );

        final game = (await replica.watchActiveGames().first).single;
        expect(game.id, 'local-1');
        expect(game.status, GameStatus.active);
        expect(await replica.decidesHere('local-1'), isTrue);
      },
    );
  });

  group('replays', () {
    test('a replay is readable only once it is held whole', () async {
      await replica.applySession(
        session(seq: 3, status: 'finished', version: 2),
        now: _now,
      );
      expect(await replica.replayFrames('g'), isNull);

      await replica.applyReplay('g', [
        for (var v = 0; v <= 2; v++) Frame.fromJson(frameJson(v)),
      ]);
      final frames = (await replica.replayFrames('g'))!;
      expect(frames.map((frame) => frame.version), [0, 1, 2]);
    });

    test('keeps only the most recently opened replays', () async {
      for (final (index, id) in ['a', 'b', 'c'].indexed) {
        await replica.applySummary(
          summary(id: id, seq: 2, status: 'finished', finishedAt: 1),
        );
        await replica.applyReplay(id, [Frame.fromJson(frameJson(0))]);
        await replica.markOpened(id, now: _now.add(Duration(minutes: index)));
      }

      await replica.evictReplays(keep: 2);

      expect(await replica.replayFrames('a'), isNull);
      expect(await replica.replayFrames('b'), isNotNull);
      expect(await replica.replayFrames('c'), isNotNull);
    });
  });

  group('an account', () {
    Future<void> seedBoth() async {
      await replica.applySync(
        accountSync(active: [summaryJson(id: 'online', seq: 2)], cursor: 5),
        first: true,
        endedSeen: const {},
        pulledAt: _now,
      );
      final engine = await LocalGameEngine.create(
        userId: me,
        schemaVersion: 1,
        config: const {'target': 5},
        botIds: const ['bot-1'],
        bots: {'bot-1': counterBot()},
        rules: const CounterRules(),
        storage: LocalGameStorage(db),
        newGameId: () => 'local-1',
      );
      await engine.close();
    }

    test('created again under the same id keeps its local games and nothing '
        'else', () async {
      await seedBoth();

      await replica.resetReplicated();

      final active = await replica.watchActiveGames().first;
      expect(active.map((game) => game.id), ['local-1']);
      expect(await replica.finishedCursor(), isNull);
      expect(await replica.watchProfile().first, isNull);
    });

    test('deleted takes every row with it, its local games included', () async {
      await seedBoth();

      await replica.deleteAll();

      expect(await replica.watchActiveGames().first, isEmpty);
      expect(await replica.decidesHere('local-1'), isFalse);
    });

    test('is invisible to another account on the same device', () async {
      await seedBoth();
      final other = AccountReplica(db, them);
      expect(await other.watchActiveGames().first, isEmpty);
      expect(await other.watchProfile().first, isNull);
    });
  });
}
