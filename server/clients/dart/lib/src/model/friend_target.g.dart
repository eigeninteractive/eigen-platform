// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'friend_target.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FriendTarget _$FriendTargetFromJson(Map<String, dynamic> json) =>
    $checkedCreate('FriendTarget', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['targetUserId']);
      final val = FriendTarget(
        targetUserId: $checkedConvert('targetUserId', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$FriendTargetToJson(FriendTarget instance) =>
    <String, dynamic>{'targetUserId': instance.targetUserId};
