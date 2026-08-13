// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'session.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Session _$SessionFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('Session', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'type',
      'seq',
      'gameId',
      'shortCode',
      'access',
      'schemaVersion',
      'config',
      'turnSeconds',
      'budgetSeconds',
      'incrementSeconds',
      'rated',
      'ratingPool',
      'minPlayers',
      'maxPlayers',
      'createdBy',
      'status',
      'players',
      'version',
      'frame',
    ],
  );
  final val = Session(
    type: $checkedConvert(
      'type',
      (v) => $enumDecode(
        _$SessionTypeEnumEnumMap,
        v,
        unknownValue: SessionTypeEnum.unknownDefaultOpenApi,
      ),
    ),
    seq: $checkedConvert('seq', (v) => (v as num).toInt()),
    gameId: $checkedConvert('gameId', (v) => v as String),
    shortCode: $checkedConvert('shortCode', (v) => v as String),
    access: $checkedConvert(
      'access',
      (v) => $enumDecode(
        _$GameAccessEnumMap,
        v,
        unknownValue: GameAccess.unknownDefaultOpenApi,
      ),
    ),
    schemaVersion: $checkedConvert('schemaVersion', (v) => (v as num).toInt()),
    config: $checkedConvert('config', (v) => v as Object),
    turnSeconds: $checkedConvert('turnSeconds', (v) => (v as num?)?.toInt()),
    budgetSeconds: $checkedConvert(
      'budgetSeconds',
      (v) => (v as num?)?.toInt(),
    ),
    incrementSeconds: $checkedConvert(
      'incrementSeconds',
      (v) => (v as num?)?.toInt(),
    ),
    rated: $checkedConvert('rated', (v) => v as bool),
    ratingPool: $checkedConvert('ratingPool', (v) => v as String?),
    minPlayers: $checkedConvert('minPlayers', (v) => (v as num).toInt()),
    maxPlayers: $checkedConvert('maxPlayers', (v) => (v as num).toInt()),
    createdBy: $checkedConvert('createdBy', (v) => v as String?),
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$GameStatusEnumMap,
        v,
        unknownValue: GameStatus.unknownDefaultOpenApi,
      ),
    ),
    players: $checkedConvert(
      'players',
      (v) => (v as List<dynamic>)
          .map((e) => Seat.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    version: $checkedConvert('version', (v) => (v as num?)?.toInt()),
    frame: $checkedConvert(
      'frame',
      (v) => v == null ? null : Frame.fromJson(v as Map<String, dynamic>),
    ),
  );
  return val;
});

Map<String, dynamic> _$SessionToJson(Session instance) => <String, dynamic>{
  'type': _$SessionTypeEnumEnumMap[instance.type]!,
  'seq': instance.seq,
  'gameId': instance.gameId,
  'shortCode': instance.shortCode,
  'access': _$GameAccessEnumMap[instance.access]!,
  'schemaVersion': instance.schemaVersion,
  'config': instance.config,
  'turnSeconds': instance.turnSeconds,
  'budgetSeconds': instance.budgetSeconds,
  'incrementSeconds': instance.incrementSeconds,
  'rated': instance.rated,
  'ratingPool': instance.ratingPool,
  'minPlayers': instance.minPlayers,
  'maxPlayers': instance.maxPlayers,
  'createdBy': instance.createdBy,
  'status': _$GameStatusEnumMap[instance.status]!,
  'players': instance.players.map((e) => e.toJson()).toList(),
  'version': instance.version,
  'frame': instance.frame?.toJson(),
};

const _$SessionTypeEnumEnumMap = {
  SessionTypeEnum.session: 'session',
  SessionTypeEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$GameAccessEnumMap = {
  GameAccess.public: 'public',
  GameAccess.private: 'private',
  GameAccess.friends: 'friends',
  GameAccess.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$GameStatusEnumMap = {
  GameStatus.waiting: 'waiting',
  GameStatus.ready: 'ready',
  GameStatus.active: 'active',
  GameStatus.finished: 'finished',
  GameStatus.aborted: 'aborted',
  GameStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};
