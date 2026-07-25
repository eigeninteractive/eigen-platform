// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'display_name_update.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DisplayNameUpdate _$DisplayNameUpdateFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DisplayNameUpdate', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['displayName']);
      final val = DisplayNameUpdate(
        displayName: $checkedConvert('displayName', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$DisplayNameUpdateToJson(DisplayNameUpdate instance) =>
    <String, dynamic>{'displayName': instance.displayName};
