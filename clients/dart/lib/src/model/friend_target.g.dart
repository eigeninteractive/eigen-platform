// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'friend_target.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FriendTarget _$FriendTargetFromJson(Map<String, dynamic> json) =>
    $checkedCreate('FriendTarget', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['target_user_id']);
      final val = FriendTarget(
        targetUserId: $checkedConvert('target_user_id', (v) => v as String),
      );
      return val;
    }, fieldKeyMap: const {'targetUserId': 'target_user_id'});

Map<String, dynamic> _$FriendTargetToJson(FriendTarget instance) =>
    <String, dynamic>{'target_user_id': instance.targetUserId};
