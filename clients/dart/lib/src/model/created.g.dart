// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'created.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Created _$CreatedFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Created', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['gameId', 'shortCode']);
      final val = Created(
        gameId: $checkedConvert('gameId', (v) => v as String),
        shortCode: $checkedConvert('shortCode', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$CreatedToJson(Created instance) => <String, dynamic>{
  'gameId': instance.gameId,
  'shortCode': instance.shortCode,
};
