// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'username_update.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UsernameUpdate _$UsernameUpdateFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UsernameUpdate', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['username']);
      final val = UsernameUpdate(
        username: $checkedConvert('username', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$UsernameUpdateToJson(UsernameUpdate instance) =>
    <String, dynamic>{'username': instance.username};
