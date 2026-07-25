// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'game_summary.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

GameSummary _$GameSummaryFromJson(Map<String, dynamic> json) => $checkedCreate(
  'GameSummary',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const [
        'id',
        'created_by',
        'status',
        'access',
        'schema_version',
        'config',
        'turn_seconds',
        'budget_seconds',
        'increment_seconds',
        'rated',
        'rating_pool',
        'min_players',
        'max_players',
        'short_code',
        'pending_players',
        'turn_deadline',
        'outcomes',
        'finished_at',
        'created_at',
        'updated_at',
        'participants',
      ],
    );
    final val = GameSummary(
      id: $checkedConvert('id', (v) => v as String),
      createdBy: $checkedConvert('created_by', (v) => v as String?),
      status: $checkedConvert(
        'status',
        (v) => $enumDecode(_$GameStatusEnumMap, v),
      ),
      access: $checkedConvert(
        'access',
        (v) => $enumDecode(_$GameAccessEnumMap, v),
      ),
      schemaVersion: $checkedConvert(
        'schema_version',
        (v) => (v as num).toInt(),
      ),
      config: $checkedConvert('config', (v) => v as Object),
      turnSeconds: $checkedConvert('turn_seconds', (v) => (v as num?)?.toInt()),
      budgetSeconds: $checkedConvert(
        'budget_seconds',
        (v) => (v as num?)?.toInt(),
      ),
      incrementSeconds: $checkedConvert(
        'increment_seconds',
        (v) => (v as num?)?.toInt(),
      ),
      rated: $checkedConvert('rated', (v) => v as bool),
      ratingPool: $checkedConvert('rating_pool', (v) => v as String?),
      minPlayers: $checkedConvert('min_players', (v) => (v as num).toInt()),
      maxPlayers: $checkedConvert('max_players', (v) => (v as num).toInt()),
      shortCode: $checkedConvert('short_code', (v) => v as String),
      pendingPlayers: $checkedConvert(
        'pending_players',
        (v) => (v as List<dynamic>?)?.map((e) => (e as num).toInt()).toList(),
      ),
      turnDeadline: $checkedConvert(
        'turn_deadline',
        (v) => (v as num?)?.toInt(),
      ),
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
      finishedAt: $checkedConvert('finished_at', (v) => (v as num?)?.toInt()),
      createdAt: $checkedConvert('created_at', (v) => (v as num).toInt()),
      updatedAt: $checkedConvert('updated_at', (v) => (v as num).toInt()),
      participants: $checkedConvert(
        'participants',
        (v) => (v as List<dynamic>)
            .map((e) => Seat.fromJson(e as Map<String, dynamic>))
            .toList(),
      ),
    );
    return val;
  },
  fieldKeyMap: const {
    'createdBy': 'created_by',
    'schemaVersion': 'schema_version',
    'turnSeconds': 'turn_seconds',
    'budgetSeconds': 'budget_seconds',
    'incrementSeconds': 'increment_seconds',
    'ratingPool': 'rating_pool',
    'minPlayers': 'min_players',
    'maxPlayers': 'max_players',
    'shortCode': 'short_code',
    'pendingPlayers': 'pending_players',
    'turnDeadline': 'turn_deadline',
    'finishedAt': 'finished_at',
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
  },
);

Map<String, dynamic> _$GameSummaryToJson(GameSummary instance) =>
    <String, dynamic>{
      'id': instance.id,
      'created_by': instance.createdBy,
      'status': _$GameStatusEnumMap[instance.status]!,
      'access': _$GameAccessEnumMap[instance.access]!,
      'schema_version': instance.schemaVersion,
      'config': instance.config,
      'turn_seconds': instance.turnSeconds,
      'budget_seconds': instance.budgetSeconds,
      'increment_seconds': instance.incrementSeconds,
      'rated': instance.rated,
      'rating_pool': instance.ratingPool,
      'min_players': instance.minPlayers,
      'max_players': instance.maxPlayers,
      'short_code': instance.shortCode,
      'pending_players': instance.pendingPlayers,
      'turn_deadline': instance.turnDeadline,
      'outcomes': instance.outcomes?.map((e) => e.toJson()).toList(),
      'ratings': ?instance.ratings?.map((e) => e.toJson()).toList(),
      'finished_at': instance.finishedAt,
      'created_at': instance.createdAt,
      'updated_at': instance.updatedAt,
      'participants': instance.participants.map((e) => e.toJson()).toList(),
    };

const _$GameStatusEnumMap = {
  GameStatus.waiting: 'waiting',
  GameStatus.ready: 'ready',
  GameStatus.active: 'active',
  GameStatus.finished: 'finished',
  GameStatus.aborted: 'aborted',
};

const _$GameAccessEnumMap = {
  GameAccess.public: 'public',
  GameAccess.private: 'private',
  GameAccess.friends: 'friends',
};
