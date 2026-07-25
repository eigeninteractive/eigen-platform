// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Profile _$ProfileFromJson(Map<String, dynamic> json) => $checkedCreate(
  'Profile',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const [
        'id',
        'username',
        'display_name',
        'avatar_url',
        'is_anonymous',
        'email',
        'created_at',
      ],
    );
    final val = Profile(
      id: $checkedConvert('id', (v) => v as String),
      username: $checkedConvert('username', (v) => v as String),
      displayName: $checkedConvert('display_name', (v) => v as String),
      avatarUrl: $checkedConvert('avatar_url', (v) => v as String),
      isAnonymous: $checkedConvert('is_anonymous', (v) => v as bool),
      email: $checkedConvert('email', (v) => v as String?),
      createdAt: $checkedConvert('created_at', (v) => (v as num).toInt()),
    );
    return val;
  },
  fieldKeyMap: const {
    'displayName': 'display_name',
    'avatarUrl': 'avatar_url',
    'isAnonymous': 'is_anonymous',
    'createdAt': 'created_at',
  },
);

Map<String, dynamic> _$ProfileToJson(Profile instance) => <String, dynamic>{
  'id': instance.id,
  'username': instance.username,
  'display_name': instance.displayName,
  'avatar_url': instance.avatarUrl,
  'is_anonymous': instance.isAnonymous,
  'email': instance.email,
  'created_at': instance.createdAt,
};
