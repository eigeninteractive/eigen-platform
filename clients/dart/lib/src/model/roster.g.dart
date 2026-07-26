// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'roster.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Roster _$RosterFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Roster', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['type', 'status', 'players']);
      final val = Roster(
        type: $checkedConvert(
          'type',
          (v) => $enumDecode(
            _$RosterTypeEnumEnumMap,
            v,
            unknownValue: RosterTypeEnum.unknownDefaultOpenApi,
          ),
        ),
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(
            _$GameStatusEnumMap,
            v,
            unknownValue: GameStatus.unknownDefaultOpenApi,
          ),
        ),
        players: $checkedConvert(
          'players',
          (v) => (v as List<dynamic>)
              .map((e) => Seat.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$RosterToJson(Roster instance) => <String, dynamic>{
  'type': _$RosterTypeEnumEnumMap[instance.type]!,
  'status': _$GameStatusEnumMap[instance.status]!,
  'players': instance.players.map((e) => e.toJson()).toList(),
};

const _$RosterTypeEnumEnumMap = {
  RosterTypeEnum.roster: 'roster',
  RosterTypeEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$GameStatusEnumMap = {
  GameStatus.waiting: 'waiting',
  GameStatus.ready: 'ready',
  GameStatus.active: 'active',
  GameStatus.finished: 'finished',
  GameStatus.aborted: 'aborted',
  GameStatus.unknownDefaultOpenApi: 'unknown_default_open_api',
};
