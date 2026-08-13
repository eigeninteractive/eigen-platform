// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'friend.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Friend _$FriendFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Friend', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'username',
          'displayName',
          'avatarUrl',
          'isAnonymous',
          'userId',
          'since',
        ],
      );
      final val = Friend(
        username: $checkedConvert('username', (v) => v as String),
        displayName: $checkedConvert('displayName', (v) => v as String),
        avatarUrl: $checkedConvert('avatarUrl', (v) => v as String?),
        isAnonymous: $checkedConvert('isAnonymous', (v) => v as bool),
        userId: $checkedConvert('userId', (v) => v as String),
        since: $checkedConvert('since', (v) => (v as num).toInt()),
      );
      return val;
    });

Map<String, dynamic> _$FriendToJson(Friend instance) => <String, dynamic>{
  'username': instance.username,
  'displayName': instance.displayName,
  'avatarUrl': instance.avatarUrl,
  'isAnonymous': instance.isAnonymous,
  'userId': instance.userId,
  'since': instance.since,
};
