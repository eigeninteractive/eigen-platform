// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'game_summary.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

GameSummary _$GameSummaryFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('GameSummary', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'createdBy',
      'status',
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
      'shortCode',
      'pendingPlayers',
      'turnDeadline',
      'outcomes',
      'finishedAt',
      'createdAt',
      'updatedAt',
      'participants',
    ],
  );
  final val = GameSummary(
    id: $checkedConvert('id', (v) => v as String),
    createdBy: $checkedConvert('createdBy', (v) => v as String?),
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$GameStatusEnumMap,
        v,
        unknownValue: GameStatus.unknownDefaultOpenApi,
      ),
    ),
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
    shortCode: $checkedConvert('shortCode', (v) => v as String),
    pendingPlayers: $checkedConvert(
      'pendingPlayers',
      (v) => (v as List<dynamic>?)?.map((e) => (e as num).toInt()).toList(),
    ),
    turnDeadline: $checkedConvert('turnDeadline', (v) => (v as num?)?.toInt()),
    outcomes: $checkedConvert(
      'outcomes',
      (v) => (v as List<dynamic>?)
          ?.map((e) => Outcome.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    ratings: $checkedConvert(
      'ratings',
      (v) => (v as List<dynamic>?)
          ?.map((e) => RatingDelta.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    finishedAt: $checkedConvert('finishedAt', (v) => (v as num?)?.toInt()),
    createdAt: $checkedConvert('createdAt', (v) => (v as num).toInt()),
    updatedAt: $checkedConvert('updatedAt', (v) => (v as num).toInt()),
    participants: $checkedConvert(
      'participants',
      (v) => (v as List<dynamic>)
          .map((e) => Seat.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$GameSummaryToJson(GameSummary instance) =>
    <String, dynamic>{
      'id': instance.id,
      'createdBy': instance.createdBy,
      'status': _$GameStatusEnumMap[instance.status]!,
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
      'shortCode': instance.shortCode,
      'pendingPlayers': instance.pendingPlayers,
      'turnDeadline': instance.turnDeadline,
      'outcomes': instance.outcomes?.map((e) => e.toJson()).toList(),
      'ratings': ?instance.ratings?.map((e) => e.toJson()).toList(),
      'finishedAt': instance.finishedAt,
      'createdAt': instance.createdAt,
      'updatedAt': instance.updatedAt,
      'participants': instance.participants.map((e) => e.toJson()).toList(),
    };

const _$GameStatusEnumMap = {
  GameStatus.waiting: 'waiting',
  GameStatus.ready: 'ready',
  GameStatus.active: 'active',
  GameStatus.finished: 'finished',
  GameStatus.aborted: 'aborted',
  GameStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$GameAccessEnumMap = {
  GameAccess.public: 'public',
  GameAccess.private: 'private',
  GameAccess.friends: 'friends',
  GameAccess.unknownDefaultOpenApi: 'unknown_default_open_api',
};
