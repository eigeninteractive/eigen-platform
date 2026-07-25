// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'friend_requests.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FriendRequests _$FriendRequestsFromJson(Map<String, dynamic> json) =>
    $checkedCreate('FriendRequests', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['requests']);
      final val = FriendRequests(
        requests: $checkedConvert(
          'requests',
          (v) => (v as List<dynamic>)
              .map((e) => FriendRequest.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$FriendRequestsToJson(FriendRequests instance) =>
    <String, dynamic>{
      'requests': instance.requests.map((e) => e.toJson()).toList(),
    };
