// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_solo.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateSolo _$CreateSoloFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateSolo', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'schemaVersion',
      'config',
      'minPlayers',
      'maxPlayers',
      'botIds',
    ],
  );
  final val = CreateSolo(
    schemaVersion: $checkedConvert('schemaVersion', (v) => (v as num).toInt()),
    config: $checkedConvert('config', (v) => v as Object),
    minPlayers: $checkedConvert('minPlayers', (v) => (v as num).toInt()),
    maxPlayers: $checkedConvert('maxPlayers', (v) => (v as num).toInt()),
    rated: $checkedConvert('rated', (v) => v as bool?),
    botIds: $checkedConvert(
      'botIds',
      (v) => (v as List<dynamic>).map((e) => e as String).toList(),
    ),
    turnSeconds: $checkedConvert('turnSeconds', (v) => (v as num?)?.toInt()),
    budgetSeconds: $checkedConvert(
      'budgetSeconds',
      (v) => (v as num?)?.toInt(),
    ),
    incrementSeconds: $checkedConvert(
      'incrementSeconds',
      (v) => (v as num?)?.toInt(),
    ),
  );
  return val;
});

Map<String, dynamic> _$CreateSoloToJson(CreateSolo instance) =>
    <String, dynamic>{
      'schemaVersion': instance.schemaVersion,
      'config': instance.config,
      'minPlayers': instance.minPlayers,
      'maxPlayers': instance.maxPlayers,
      'rated': ?instance.rated,
      'botIds': instance.botIds,
      'turnSeconds': ?instance.turnSeconds,
      'budgetSeconds': ?instance.budgetSeconds,
      'incrementSeconds': ?instance.incrementSeconds,
    };
