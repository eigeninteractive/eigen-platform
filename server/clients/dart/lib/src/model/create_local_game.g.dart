// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_local_game.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateLocalGame _$CreateLocalGameFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CreateLocalGame', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'gameId',
          'schemaVersion',
          'config',
          'botIds',
          'seed',
          'createdAt',
        ],
      );
      final val = CreateLocalGame(
        gameId: $checkedConvert('gameId', (v) => v as String),
        schemaVersion: $checkedConvert(
          'schemaVersion',
          (v) => (v as num).toInt(),
        ),
        config: $checkedConvert('config', (v) => v as Object),
        minPlayers: $checkedConvert('minPlayers', (v) => (v as num?)?.toInt()),
        maxPlayers: $checkedConvert('maxPlayers', (v) => (v as num?)?.toInt()),
        botIds: $checkedConvert(
          'botIds',
          (v) => (v as List<dynamic>).map((e) => e as String).toList(),
        ),
        seed: $checkedConvert('seed', (v) => v as String),
        createdAt: $checkedConvert('createdAt', (v) => (v as num).toInt()),
      );
      return val;
    });

Map<String, dynamic> _$CreateLocalGameToJson(CreateLocalGame instance) =>
    <String, dynamic>{
      'gameId': instance.gameId,
      'schemaVersion': instance.schemaVersion,
      'config': instance.config,
      'minPlayers': ?instance.minPlayers,
      'maxPlayers': ?instance.maxPlayers,
      'botIds': instance.botIds,
      'seed': instance.seed,
      'createdAt': instance.createdAt,
    };
