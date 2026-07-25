// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'friend.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Friend _$FriendFromJson(Map<String, dynamic> json) => $checkedCreate(
  'Friend',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const [
        'username',
        'display_name',
        'avatar_url',
        'is_anonymous',
        'user_id',
        'since',
      ],
    );
    final val = Friend(
      username: $checkedConvert('username', (v) => v as String),
      displayName: $checkedConvert('display_name', (v) => v as String),
      avatarUrl: $checkedConvert('avatar_url', (v) => v as String?),
      isAnonymous: $checkedConvert('is_anonymous', (v) => v as bool),
      userId: $checkedConvert('user_id', (v) => v as String),
      since: $checkedConvert('since', (v) => (v as num).toInt()),
    );
    return val;
  },
  fieldKeyMap: const {
    'displayName': 'display_name',
    'avatarUrl': 'avatar_url',
    'isAnonymous': 'is_anonymous',
    'userId': 'user_id',
  },
);

Map<String, dynamic> _$FriendToJson(Friend instance) => <String, dynamic>{
  'username': instance.username,
  'display_name': instance.displayName,
  'avatar_url': instance.avatarUrl,
  'is_anonymous': instance.isAnonymous,
  'user_id': instance.userId,
  'since': instance.since,
};
