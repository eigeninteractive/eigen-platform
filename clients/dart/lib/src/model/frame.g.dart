// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'frame.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Frame _$FrameFromJson(Map<String, dynamic> json) => $checkedCreate(
  'Frame',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const [
        'type',
        'version',
        'data',
        'pending_players',
        'deadline',
        'player_times',
      ],
    );
    final val = Frame(
      type: $checkedConvert(
        'type',
        (v) => $enumDecode(_$FrameTypeEnumEnumMap, v),
      ),
      version: $checkedConvert('version', (v) => (v as num).toInt()),
      data: $checkedConvert('data', (v) => v as Object),
      pendingPlayers: $checkedConvert(
        'pending_players',
        (v) => (v as List<dynamic>).map((e) => (e as num).toInt()).toList(),
      ),
      deadline: $checkedConvert('deadline', (v) => (v as num?)?.toInt()),
      playerTimes: $checkedConvert(
        'player_times',
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
  },
  fieldKeyMap: const {
    'pendingPlayers': 'pending_players',
    'playerTimes': 'player_times',
  },
);

Map<String, dynamic> _$FrameToJson(Frame instance) => <String, dynamic>{
  'type': _$FrameTypeEnumEnumMap[instance.type]!,
  'version': instance.version,
  'data': instance.data,
  'pending_players': instance.pendingPlayers,
  'deadline': instance.deadline,
  'player_times': instance.playerTimes,
  'outcomes': ?instance.outcomes?.map((e) => e.toJson()).toList(),
  'ratings': ?instance.ratings?.map((e) => e.toJson()).toList(),
};

const _$FrameTypeEnumEnumMap = {FrameTypeEnum.frame: 'frame'};
