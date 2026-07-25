// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'action.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Action _$ActionFromJson(Map<String, dynamic> json) => $checkedCreate(
  'Action',
  json,
  ($checkedConvert) {
    $checkKeys(json, requiredKeys: const ['seat', 'expected_version']);
    final val = Action(
      seat: $checkedConvert('seat', (v) => (v as num).toInt()),
      data: $checkedConvert('data', (v) => v),
      expectedVersion: $checkedConvert(
        'expected_version',
        (v) => (v as num).toInt(),
      ),
      commandId: $checkedConvert('command_id', (v) => v as String?),
    );
    return val;
  },
  fieldKeyMap: const {
    'expectedVersion': 'expected_version',
    'commandId': 'command_id',
  },
);

Map<String, dynamic> _$ActionToJson(Action instance) => <String, dynamic>{
  'seat': instance.seat,
  'data': ?instance.data,
  'expected_version': instance.expectedVersion,
  'command_id': ?instance.commandId,
};
