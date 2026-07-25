// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rating_identity.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RatingIdentity _$RatingIdentityFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RatingIdentity', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['user_id', 'bot_id']);
      final val = RatingIdentity(
        userId: $checkedConvert('user_id', (v) => v as String?),
        botId: $checkedConvert('bot_id', (v) => v as String?),
      );
      return val;
    }, fieldKeyMap: const {'userId': 'user_id', 'botId': 'bot_id'});

Map<String, dynamic> _$RatingIdentityToJson(RatingIdentity instance) =>
    <String, dynamic>{'user_id': instance.userId, 'bot_id': instance.botId};
