// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'seat.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Seat _$SeatFromJson(Map<String, dynamic> json) => $checkedCreate(
  'Seat',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const ['player_index', 'user_id', 'bot_id', 'type'],
    );
    final val = Seat(
      playerIndex: $checkedConvert('player_index', (v) => (v as num).toInt()),
      userId: $checkedConvert('user_id', (v) => v as String?),
      botId: $checkedConvert('bot_id', (v) => v as String?),
      type: $checkedConvert(
        'type',
        (v) => $enumDecode(_$SeatTypeEnumEnumMap, v),
      ),
    );
    return val;
  },
  fieldKeyMap: const {
    'playerIndex': 'player_index',
    'userId': 'user_id',
    'botId': 'bot_id',
  },
);

Map<String, dynamic> _$SeatToJson(Seat instance) => <String, dynamic>{
  'player_index': instance.playerIndex,
  'user_id': instance.userId,
  'bot_id': instance.botId,
  'type': _$SeatTypeEnumEnumMap[instance.type]!,
};

const _$SeatTypeEnumEnumMap = {
  SeatTypeEnum.human: 'human',
  SeatTypeEnum.bot: 'bot',
};
