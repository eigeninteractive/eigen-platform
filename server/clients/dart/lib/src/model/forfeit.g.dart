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
      );
      return val;
    });

Map<String, dynamic> _$ForfeitToJson(Forfeit instance) => <String, dynamic>{
  'seat': instance.seat,
};
