import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:checks/checks.dart';
import 'package:dio/dio.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

/// A record route that answers a bounded page, exactly as the engine's does.
class _PagedRecord implements HttpClientAdapter {
  _PagedRecord({required this.serverVersion, required this.page});

  /// The version the whole log reaches.
  final int serverVersion;

  /// The most transitions one response carries.
  final int page;

  final asked = <({int from, int? to})>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final from = (options.queryParameters['from'] as int?) ?? 0;
    final to = options.queryParameters['to'] as int?;
    asked.add((from: from, to: to));
    final last = [
      from + page - 1,
      ?to,
      serverVersion,
    ].reduce((a, b) => a < b ? a : b);
    return ResponseBody.fromString(
      jsonEncode({
        'session': {
          'type': 'session',
          'seq': serverVersion + 1,
          'gameId': 'game-1',
          'shortCode': '',
          'access': 'private',
          'origin': 'local',
          'schemaVersion': 1,
          'config': <String, dynamic>{},
          'turnSeconds': null,
          'budgetSeconds': null,
          'incrementSeconds': null,
          'rated': false,
          'ratingPool': null,
          'minPlayers': 2,
          'maxPlayers': 2,
          'createdBy': 'user-a',
          'status': 'active',
          'players': <Map<String, dynamic>>[],
          'version': serverVersion,
          'frame': null,
        },
        'seed': 'a' * 32,
        'createdAt': 0,
        'finishedAt': null,
        'transitions': [
          for (var v = from; v <= last; v++)
            {
              'version': v,
              'state': {'count': v},
              'action': null,
              'pending': <int>[],
            },
        ],
      }),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class _NoSocket implements GameSocket {
  @override
  Stream<GameSocketEvent> connect(String gameId) => const Stream.empty();

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

GameRepository _repo(HttpClientAdapter adapter) => GameRepository(
  Dio(BaseOptions(baseUrl: 'https://engine.test'))..httpClientAdapter = adapter,
  _NoSocket(),
);

void main() {
  test('follows the record route\'s pages to the end of the log', () async {
    final adapter = _PagedRecord(serverVersion: 2500, page: 1000);

    final record = await _repo(adapter).getWholeLocalRecord('game-1');

    check(record.transitions.length).equals(2501);
    check(record.transitions.first.version).equals(0);
    check(record.transitions.last.version).equals(2500);
    // Each page asked for the version after the last one it received, so no
    // transition is fetched twice and none is skipped.
    check(adapter.asked.map((ask) => ask.from)).deepEquals([0, 1000, 2000]);
  });

  test('a log that fits in one page costs one request', () async {
    final adapter = _PagedRecord(serverVersion: 4, page: 1000);

    final record = await _repo(adapter).getWholeLocalRecord('game-1');

    check(record.transitions.length).equals(5);
    check(adapter.asked.length).equals(1);
  });

  test('a pulled log is complete enough to rebuild from', () async {
    final adapter = _PagedRecord(serverVersion: 1200, page: 1000);

    final record = await _repo(adapter).getWholeLocalRecord('game-1');

    // The guard localRecordFromRemote applies: one transition per version,
    // version 0 through the session's own.
    check(record.transitions.length).equals((record.session.version ?? 0) + 1);
  });
}
