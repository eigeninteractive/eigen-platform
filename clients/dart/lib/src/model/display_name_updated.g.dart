// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'display_name_updated.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DisplayNameUpdated _$DisplayNameUpdatedFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DisplayNameUpdated', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['display_name']);
      final val = DisplayNameUpdated(
        displayName: $checkedConvert('display_name', (v) => v as String),
      );
      return val;
    }, fieldKeyMap: const {'displayName': 'display_name'});

Map<String, dynamic> _$DisplayNameUpdatedToJson(DisplayNameUpdated instance) =>
    <String, dynamic>{'display_name': instance.displayName};
