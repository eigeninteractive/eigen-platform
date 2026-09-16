import 'package:eigen_client/eigen_client.dart';

/// Wire values built from JSON, so the generated decoding runs exactly as it
/// does against a server.

const me = 'user-a';
const them = 'user-b';

Map<String, dynamic> seatJson(int index, {String? userId, String? botId}) => {
  'playerIndex': index,
  'userId': userId,
  'botId': botId,
  'type': botId == null ? 'human' : 'bot',
};

Map<String, dynamic> summaryJson({
  required String id,
  required int seq,
  String status = 'active',
  String origin = 'online',
  List<int>? pending = const [0],
  int? finishedAt,
  int updatedAt = 1000,
  List<Map<String, dynamic>>? participants,
  List<Map<String, dynamic>>? ratings,
}) => {
  'id': id,
  'seq': seq,
  'createdBy': me,
  'status': status,
  'access': 'public',
  'origin': origin,
  'schemaVersion': 1,
  'config': <String, dynamic>{'target': 3},
  'turnSeconds': 60,
  'budgetSeconds': null,
  'incrementSeconds': null,
  'rated': ratings != null,
  'ratingPool': ratings == null ? null : 'pool',
  'minPlayers': 2,
  'maxPlayers': 2,
  'shortCode': 'ABC123',
  'pendingPlayers': pending,
  'turnDeadline': null,
  'outcomes': null,
  'ratings': ?ratings,
  'finishedAt': finishedAt,
  'createdAt': 500,
  'updatedAt': updatedAt,
  'participants':
      participants ?? [seatJson(0, userId: me), seatJson(1, userId: them)],
};

GameSummary summary({
  required String id,
  required int seq,
  String status = 'active',
  String origin = 'online',
  List<int>? pending = const [0],
  int? finishedAt,
  int updatedAt = 1000,
  List<Map<String, dynamic>>? participants,
  List<Map<String, dynamic>>? ratings,
}) => GameSummary.fromJson(
  summaryJson(
    id: id,
    seq: seq,
    status: status,
    origin: origin,
    pending: pending,
    finishedAt: finishedAt,
    updatedAt: updatedAt,
    participants: participants,
    ratings: ratings,
  ),
);

Map<String, dynamic> frameJson(int version, {List<int> pending = const [0]}) =>
    {
      'type': 'frame',
      'version': version,
      'data': <String, dynamic>{'v': version},
      'pendingPlayers': pending,
      'deadline': null,
      'playerTimes': null,
    };

Map<String, dynamic> sessionJson({
  String gameId = 'g',
  required int seq,
  String status = 'active',
  int? version,
  List<Map<String, dynamic>>? players,
}) => {
  'type': 'session',
  'seq': seq,
  'gameId': gameId,
  'shortCode': 'ABC123',
  'access': 'public',
  'origin': 'online',
  'schemaVersion': 1,
  'config': <String, dynamic>{'target': 3},
  'turnSeconds': 60,
  'budgetSeconds': null,
  'incrementSeconds': null,
  'rated': false,
  'ratingPool': null,
  'minPlayers': 2,
  'maxPlayers': 2,
  'createdBy': me,
  'status': status,
  'players': players ?? [seatJson(0, userId: me), seatJson(1, userId: them)],
  'version': version,
  'frame': version == null ? null : frameJson(version),
};

Session session({
  String gameId = 'g',
  required int seq,
  String status = 'active',
  int? version,
  List<Map<String, dynamic>>? players,
}) => Session.fromJson(
  sessionJson(
    gameId: gameId,
    seq: seq,
    status: status,
    version: version,
    players: players,
  ),
);

Map<String, dynamic> playerJson(String id) => {
  'id': id,
  'username': id,
  'displayName': 'Player $id',
  'avatarUrl': null,
  'isAnonymous': false,
};

Map<String, dynamic> syncJson({
  int createdAt = 1,
  List<Map<String, dynamic>> active = const [],
  List<Map<String, dynamic>> finished = const [],
  List<Map<String, dynamic>> friends = const [],
  List<Map<String, dynamic>> requests = const [],
  List<Map<String, dynamic>> ratings = const [],
  int cursor = 0,
  bool hasMore = false,
  String? floor,
}) => {
  'account': {
    ...playerJson(me),
    'email': 'a@example.test',
    'createdAt': createdAt,
  },
  'ratings': ratings,
  'friends': friends,
  'friendRequests': requests,
  'activeGames': active,
  'finishedGames': finished,
  'players': [playerJson(me), playerJson(them)],
  'finishedCursor': cursor,
  'hasMoreFinished': hasMore,
  'historyFloor': floor,
};

AccountSync accountSync({
  int createdAt = 1,
  List<Map<String, dynamic>> active = const [],
  List<Map<String, dynamic>> finished = const [],
  List<Map<String, dynamic>> friends = const [],
  List<Map<String, dynamic>> requests = const [],
  List<Map<String, dynamic>> ratings = const [],
  int cursor = 0,
  bool hasMore = false,
  String? floor,
}) => AccountSync.fromJson(
  syncJson(
    createdAt: createdAt,
    active: active,
    finished: finished,
    friends: friends,
    requests: requests,
    ratings: ratings,
    cursor: cursor,
    hasMore: hasMore,
    floor: floor,
  ),
);

Map<String, dynamic> friendJson(String userId, {String? direction}) => {
  'userId': userId,
  'username': userId,
  'displayName': 'Player $userId',
  'avatarUrl': null,
  'isAnonymous': false,
  'since': 42,
  'direction': ?direction,
};
