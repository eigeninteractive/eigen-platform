// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'joined.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Joined _$JoinedFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Joined', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['gameId', 'roster']);
      final val = Joined(
        gameId: $checkedConvert('gameId', (v) => v as String),
        roster: $checkedConvert(
          'roster',
          (v) => Roster.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$JoinedToJson(Joined instance) => <String, dynamic>{
  'gameId': instance.gameId,
  'roster': instance.roster.toJson(),
};
