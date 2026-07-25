// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'solo_started.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SoloStarted _$SoloStartedFromJson(Map<String, dynamic> json) => $checkedCreate(
  'SoloStarted',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const ['game_id', 'short_code', 'version', 'frame'],
    );
    final val = SoloStarted(
      gameId: $checkedConvert('game_id', (v) => v as String),
      shortCode: $checkedConvert('short_code', (v) => v as String),
      version: $checkedConvert('version', (v) => (v as num).toInt()),
      frame: $checkedConvert(
        'frame',
        (v) => Frame.fromJson(v as Map<String, dynamic>),
      ),
    );
    return val;
  },
  fieldKeyMap: const {'gameId': 'game_id', 'shortCode': 'short_code'},
);

Map<String, dynamic> _$SoloStartedToJson(SoloStarted instance) =>
    <String, dynamic>{
      'game_id': instance.gameId,
      'short_code': instance.shortCode,
      'version': instance.version,
      'frame': instance.frame.toJson(),
    };
