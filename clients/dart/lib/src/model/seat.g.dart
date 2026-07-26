// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'seat.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Seat _$SeatFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Seat', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['playerIndex', 'userId', 'botId', 'type'],
      );
      final val = Seat(
        playerIndex: $checkedConvert('playerIndex', (v) => (v as num).toInt()),
        userId: $checkedConvert('userId', (v) => v as String?),
        botId: $checkedConvert('botId', (v) => v as String?),
        type: $checkedConvert(
          'type',
          (v) => $enumDecode(
            _$SeatTypeEnumEnumMap,
            v,
            unknownValue: SeatTypeEnum.unknownDefaultOpenApi,
          ),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SeatToJson(Seat instance) => <String, dynamic>{
  'playerIndex': instance.playerIndex,
  'userId': instance.userId,
  'botId': instance.botId,
  'type': _$SeatTypeEnumEnumMap[instance.type]!,
};

const _$SeatTypeEnumEnumMap = {
  SeatTypeEnum.human: 'human',
  SeatTypeEnum.bot: 'bot',
  SeatTypeEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
