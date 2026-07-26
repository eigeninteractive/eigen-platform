// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'friend_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FriendRequest _$FriendRequestFromJson(Map<String, dynamic> json) =>
    $checkedCreate('FriendRequest', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'username',
          'displayName',
          'avatarUrl',
          'isAnonymous',
          'userId',
          'since',
          'direction',
        ],
      );
      final val = FriendRequest(
        username: $checkedConvert('username', (v) => v as String),
        displayName: $checkedConvert('displayName', (v) => v as String),
        avatarUrl: $checkedConvert('avatarUrl', (v) => v as String?),
        isAnonymous: $checkedConvert('isAnonymous', (v) => v as bool),
        userId: $checkedConvert('userId', (v) => v as String),
        since: $checkedConvert('since', (v) => (v as num).toInt()),
        direction: $checkedConvert(
          'direction',
          (v) => $enumDecode(
            _$FriendRequestDirectionEnumEnumMap,
            v,
            unknownValue: FriendRequestDirectionEnum.unknownDefaultOpenApi,
          ),
        ),
      );
      return val;
    });

Map<String, dynamic> _$FriendRequestToJson(FriendRequest instance) =>
    <String, dynamic>{
      'username': instance.username,
      'displayName': instance.displayName,
      'avatarUrl': instance.avatarUrl,
      'isAnonymous': instance.isAnonymous,
      'userId': instance.userId,
      'since': instance.since,
      'direction': _$FriendRequestDirectionEnumEnumMap[instance.direction]!,
    };

const _$FriendRequestDirectionEnumEnumMap = {
  FriendRequestDirectionEnum.incoming: 'incoming',
  FriendRequestDirectionEnum.outgoing: 'outgoing',
  FriendRequestDirectionEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
