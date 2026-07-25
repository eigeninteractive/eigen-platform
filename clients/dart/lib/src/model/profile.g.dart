// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Profile _$ProfileFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Profile', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'username',
          'displayName',
          'avatarUrl',
          'isAnonymous',
          'email',
          'createdAt',
        ],
      );
      final val = Profile(
        id: $checkedConvert('id', (v) => v as String),
        username: $checkedConvert('username', (v) => v as String),
        displayName: $checkedConvert('displayName', (v) => v as String),
        avatarUrl: $checkedConvert('avatarUrl', (v) => v as String),
        isAnonymous: $checkedConvert('isAnonymous', (v) => v as bool),
        email: $checkedConvert('email', (v) => v as String?),
        createdAt: $checkedConvert('createdAt', (v) => (v as num).toInt()),
      );
      return val;
    });

Map<String, dynamic> _$ProfileToJson(Profile instance) => <String, dynamic>{
  'id': instance.id,
  'username': instance.username,
  'displayName': instance.displayName,
  'avatarUrl': instance.avatarUrl,
  'isAnonymous': instance.isAnonymous,
  'email': instance.email,
  'createdAt': instance.createdAt,
};
