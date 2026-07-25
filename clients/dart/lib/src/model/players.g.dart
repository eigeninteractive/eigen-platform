// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'players.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Players _$PlayersFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Players', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['players']);
      final val = Players(
        players: $checkedConvert(
          'players',
          (v) => (v as List<dynamic>)
              .map((e) => Player.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$PlayersToJson(Players instance) => <String, dynamic>{
  'players': instance.players.map((e) => e.toJson()).toList(),
};
