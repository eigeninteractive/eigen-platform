// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'frame.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Frame _$FrameFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Frame', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'type',
          'version',
          'data',
          'pendingPlayers',
          'deadline',
          'playerTimes',
        ],
      );
      final val = Frame(
        type: $checkedConvert(
          'type',
          (v) => $enumDecode(
            _$FrameTypeEnumEnumMap,
            v,
            unknownValue: FrameTypeEnum.unknownDefaultOpenApi,
          ),
        ),
        version: $checkedConvert('version', (v) => (v as num).toInt()),
        data: $checkedConvert('data', (v) => v as Object),
        pendingPlayers: $checkedConvert(
          'pendingPlayers',
          (v) => (v as List<dynamic>).map((e) => (e as num).toInt()).toList(),
        ),
        deadline: $checkedConvert('deadline', (v) => (v as num?)?.toInt()),
        playerTimes: $checkedConvert(
          'playerTimes',
          (v) => (v as List<dynamic>?)?.map((e) => (e as num).toInt()).toList(),
        ),
        outcomes: $checkedConvert(
          'outcomes',
          (v) => (v as List<dynamic>?)
              ?.map((e) => Outcome.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        ratings: $checkedConvert(
          'ratings',
          (v) => (v as List<dynamic>?)
              ?.map((e) => RatingDelta.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$FrameToJson(Frame instance) => <String, dynamic>{
  'type': _$FrameTypeEnumEnumMap[instance.type]!,
  'version': instance.version,
  'data': instance.data,
  'pendingPlayers': instance.pendingPlayers,
  'deadline': instance.deadline,
  'playerTimes': instance.playerTimes,
  'outcomes': ?instance.outcomes?.map((e) => e.toJson()).toList(),
  'ratings': ?instance.ratings?.map((e) => e.toJson()).toList(),
};

const _$FrameTypeEnumEnumMap = {
  FrameTypeEnum.frame: 'frame',
  FrameTypeEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
