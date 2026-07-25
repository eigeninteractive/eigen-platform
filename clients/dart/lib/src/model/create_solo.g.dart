// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_solo.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateSolo _$CreateSoloFromJson(Map<String, dynamic> json) => $checkedCreate(
  'CreateSolo',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const [
        'schema_version',
        'config',
        'min_players',
        'max_players',
        'bot_ids',
      ],
    );
    final val = CreateSolo(
      schemaVersion: $checkedConvert(
        'schema_version',
        (v) => (v as num).toInt(),
      ),
      config: $checkedConvert('config', (v) => v as Object),
      minPlayers: $checkedConvert('min_players', (v) => (v as num).toInt()),
      maxPlayers: $checkedConvert('max_players', (v) => (v as num).toInt()),
      rated: $checkedConvert('rated', (v) => v as bool?),
      botIds: $checkedConvert(
        'bot_ids',
        (v) => (v as List<dynamic>).map((e) => e as String).toList(),
      ),
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
    'botIds': 'bot_ids',
    'turnSeconds': 'turn_seconds',
    'budgetSeconds': 'budget_seconds',
    'incrementSeconds': 'increment_seconds',
  },
);

Map<String, dynamic> _$CreateSoloToJson(CreateSolo instance) =>
    <String, dynamic>{
      'schema_version': instance.schemaVersion,
      'config': instance.config,
      'min_players': instance.minPlayers,
      'max_players': instance.maxPlayers,
      'rated': ?instance.rated,
      'bot_ids': instance.botIds,
      'turn_seconds': ?instance.turnSeconds,
      'budget_seconds': ?instance.budgetSeconds,
      'increment_seconds': ?instance.incrementSeconds,
    };
