// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'friend_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FriendRequest _$FriendRequestFromJson(Map<String, dynamic> json) =>
    $checkedCreate(
      'FriendRequest',
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
            'direction',
          ],
        );
        final val = FriendRequest(
          username: $checkedConvert('username', (v) => v as String),
          displayName: $checkedConvert('display_name', (v) => v as String),
          avatarUrl: $checkedConvert('avatar_url', (v) => v as String?),
          isAnonymous: $checkedConvert('is_anonymous', (v) => v as bool),
          userId: $checkedConvert('user_id', (v) => v as String),
          since: $checkedConvert('since', (v) => (v as num).toInt()),
          direction: $checkedConvert(
            'direction',
            (v) => $enumDecode(_$FriendRequestDirectionEnumEnumMap, v),
          ),
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

Map<String, dynamic> _$FriendRequestToJson(FriendRequest instance) =>
    <String, dynamic>{
      'username': instance.username,
      'display_name': instance.displayName,
      'avatar_url': instance.avatarUrl,
      'is_anonymous': instance.isAnonymous,
      'user_id': instance.userId,
      'since': instance.since,
      'direction': _$FriendRequestDirectionEnumEnumMap[instance.direction]!,
    };

const _$FriendRequestDirectionEnumEnumMap = {
  FriendRequestDirectionEnum.incoming: 'incoming',
  FriendRequestDirectionEnum.outgoing: 'outgoing',
};
