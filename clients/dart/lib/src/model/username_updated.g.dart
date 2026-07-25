// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'username_updated.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UsernameUpdated _$UsernameUpdatedFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UsernameUpdated', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['username']);
      final val = UsernameUpdated(
        username: $checkedConvert('username', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$UsernameUpdatedToJson(UsernameUpdated instance) =>
    <String, dynamic>{'username': instance.username};
