// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_game.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateGame _$CreateGameFromJson(Map<String, dynamic> json) => $checkedCreate(
  'CreateGame',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const [
        'access',
        'schema_version',
        'config',
        'min_players',
        'max_players',
      ],
    );
    final val = CreateGame(
      access: $checkedConvert(
        'access',
        (v) => $enumDecode(_$GameAccessEnumMap, v),
      ),
      schemaVersion: $checkedConvert(
        'schema_version',
        (v) => (v as num).toInt(),
      ),
      config: $checkedConvert('config', (v) => v as Object),
      minPlayers: $checkedConvert('min_players', (v) => (v as num).toInt()),
      maxPlayers: $checkedConvert('max_players', (v) => (v as num).toInt()),
      rated: $checkedConvert('rated', (v) => v as bool?),
      turnSeconds: $checkedConvert('turn_seconds', (v) => (v as num?)?.toInt()),
      budgetSeconds: $checkedConvert(
        'budget_seconds',
        (v) => (v as num?)?.toInt(),
      ),
      incrementSeconds: $checkedConvert(
        'increment_seconds',
        (v) => (v as num?)?.toInt(),
      ),
    );
    return val;
  },
  fieldKeyMap: const {
    'schemaVersion': 'schema_version',
    'minPlayers': 'min_players',
    'maxPlayers': 'max_players',
    'turnSeconds': 'turn_seconds',
    'budgetSeconds': 'budget_seconds',
    'incrementSeconds': 'increment_seconds',
  },
);

Map<String, dynamic> _$CreateGameToJson(CreateGame instance) =>
    <String, dynamic>{
      'access': _$GameAccessEnumMap[instance.access]!,
      'schema_version': instance.schemaVersion,
      'config': instance.config,
      'min_players': instance.minPlayers,
      'max_players': instance.maxPlayers,
      'rated': ?instance.rated,
      'turn_seconds': ?instance.turnSeconds,
      'budget_seconds': ?instance.budgetSeconds,
      'increment_seconds': ?instance.incrementSeconds,
    };

const _$GameAccessEnumMap = {
  GameAccess.public: 'public',
  GameAccess.private: 'private',
  GameAccess.friends: 'friends',
};
