// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'action.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Action _$ActionFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Action', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['seat', 'expectedVersion']);
      final val = Action(
        seat: $checkedConvert('seat', (v) => (v as num).toInt()),
        data: $checkedConvert('data', (v) => v),
        expectedVersion: $checkedConvert(
          'expectedVersion',
          (v) => (v as num).toInt(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ActionToJson(Action instance) => <String, dynamic>{
  'seat': instance.seat,
  'data': ?instance.data,
  'expectedVersion': instance.expectedVersion,
};
