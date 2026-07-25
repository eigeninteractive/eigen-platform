// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'display_name_updated.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DisplayNameUpdated _$DisplayNameUpdatedFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DisplayNameUpdated', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['displayName']);
      final val = DisplayNameUpdated(
        displayName: $checkedConvert('displayName', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$DisplayNameUpdatedToJson(DisplayNameUpdated instance) =>
    <String, dynamic>{'displayName': instance.displayName};
