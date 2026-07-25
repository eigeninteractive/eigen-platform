// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rating_identity.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RatingIdentity _$RatingIdentityFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RatingIdentity', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['userId', 'botId']);
      final val = RatingIdentity(
        userId: $checkedConvert('userId', (v) => v as String?),
        botId: $checkedConvert('botId', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$RatingIdentityToJson(RatingIdentity instance) =>
    <String, dynamic>{'userId': instance.userId, 'botId': instance.botId};
