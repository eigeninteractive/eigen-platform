// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'display_name_update.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DisplayNameUpdate _$DisplayNameUpdateFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DisplayNameUpdate', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['display_name']);
      final val = DisplayNameUpdate(
        displayName: $checkedConvert('display_name', (v) => v as String),
      );
      return val;
    }, fieldKeyMap: const {'displayName': 'display_name'});

Map<String, dynamic> _$DisplayNameUpdateToJson(DisplayNameUpdate instance) =>
    <String, dynamic>{'display_name': instance.displayName};
