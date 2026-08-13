// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'friend_request_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FriendRequestResult _$FriendRequestResultFromJson(Map<String, dynamic> json) =>
    $checkedCreate('FriendRequestResult', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['status']);
      final val = FriendRequestResult(
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(
            _$FriendRequestResultStatusEnumEnumMap,
            v,
            unknownValue: FriendRequestResultStatusEnum.unknownDefaultOpenApi,
          ),
        ),
      );
      return val;
    });

Map<String, dynamic> _$FriendRequestResultToJson(
  FriendRequestResult instance,
) => <String, dynamic>{
  'status': _$FriendRequestResultStatusEnumEnumMap[instance.status]!,
};

const _$FriendRequestResultStatusEnumEnumMap = {
  FriendRequestResultStatusEnum.requested: 'requested',
  FriendRequestResultStatusEnum.accepted: 'accepted',
  FriendRequestResultStatusEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
