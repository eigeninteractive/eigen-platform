// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'created.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Created _$CreatedFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Created', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['game_id', 'short_code']);
      final val = Created(
        gameId: $checkedConvert('game_id', (v) => v as String),
        shortCode: $checkedConvert('short_code', (v) => v as String),
      );
      return val;
    }, fieldKeyMap: const {'gameId': 'game_id', 'shortCode': 'short_code'});

Map<String, dynamic> _$CreatedToJson(Created instance) => <String, dynamic>{
  'game_id': instance.gameId,
  'short_code': instance.shortCode,
};
