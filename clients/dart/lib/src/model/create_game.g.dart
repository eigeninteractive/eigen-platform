// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_game.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateGame _$CreateGameFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateGame', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'access',
      'schemaVersion',
      'config',
      'minPlayers',
      'maxPlayers',
    ],
  );
  final val = CreateGame(
    access: $checkedConvert(
      'access',
      (v) => $enumDecode(_$GameAccessEnumMap, v),
    ),
    schemaVersion: $checkedConvert('schemaVersion', (v) => (v as num).toInt()),
    config: $checkedConvert('config', (v) => v as Object),
    minPlayers: $checkedConvert('minPlayers', (v) => (v as num).toInt()),
    maxPlayers: $checkedConvert('maxPlayers', (v) => (v as num).toInt()),
    rated: $checkedConvert('rated', (v) => v as bool?),
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

Map<String, dynamic> _$CreateGameToJson(CreateGame instance) =>
    <String, dynamic>{
      'access': _$GameAccessEnumMap[instance.access]!,
      'schemaVersion': instance.schemaVersion,
      'config': instance.config,
      'minPlayers': instance.minPlayers,
      'maxPlayers': instance.maxPlayers,
      'rated': ?instance.rated,
      'turnSeconds': ?instance.turnSeconds,
      'budgetSeconds': ?instance.budgetSeconds,
      'incrementSeconds': ?instance.incrementSeconds,
    };

const _$GameAccessEnumMap = {
  GameAccess.public: 'public',
  GameAccess.private: 'private',
  GameAccess.friends: 'friends',
};
