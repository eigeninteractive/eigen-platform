// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'joined.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Joined _$JoinedFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Joined', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['game_id', 'roster']);
      final val = Joined(
        gameId: $checkedConvert('game_id', (v) => v as String),
        roster: $checkedConvert(
          'roster',
          (v) => Roster.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    }, fieldKeyMap: const {'gameId': 'game_id'});

Map<String, dynamic> _$JoinedToJson(Joined instance) => <String, dynamic>{
  'game_id': instance.gameId,
  'roster': instance.roster.toJson(),
};
