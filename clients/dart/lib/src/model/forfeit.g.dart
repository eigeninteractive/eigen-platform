// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'forfeit.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Forfeit _$ForfeitFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Forfeit', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['seat']);
      final val = Forfeit(
        seat: $checkedConvert('seat', (v) => (v as num).toInt()),
        commandId: $checkedConvert('command_id', (v) => v as String?),
      );
      return val;
    }, fieldKeyMap: const {'commandId': 'command_id'});

Map<String, dynamic> _$ForfeitToJson(Forfeit instance) => <String, dynamic>{
  'seat': instance.seat,
  'command_id': ?instance.commandId,
};
