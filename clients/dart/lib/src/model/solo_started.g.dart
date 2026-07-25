// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'solo_started.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SoloStarted _$SoloStartedFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SoloStarted', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['gameId', 'shortCode', 'version', 'frame'],
      );
      final val = SoloStarted(
        gameId: $checkedConvert('gameId', (v) => v as String),
        shortCode: $checkedConvert('shortCode', (v) => v as String),
        version: $checkedConvert('version', (v) => (v as num).toInt()),
        frame: $checkedConvert(
          'frame',
          (v) => Frame.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SoloStartedToJson(SoloStarted instance) =>
    <String, dynamic>{
      'gameId': instance.gameId,
      'shortCode': instance.shortCode,
      'version': instance.version,
      'frame': instance.frame.toJson(),
    };
