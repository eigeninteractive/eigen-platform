// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'player.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Player _$PlayerFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Player', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'username',
          'displayName',
          'avatarUrl',
          'isAnonymous',
        ],
      );
      final val = Player(
        id: $checkedConvert('id', (v) => v as String),
        username: $checkedConvert('username', (v) => v as String),
        displayName: $checkedConvert('displayName', (v) => v as String),
        avatarUrl: $checkedConvert('avatarUrl', (v) => v as String?),
        isAnonymous: $checkedConvert('isAnonymous', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$PlayerToJson(Player instance) => <String, dynamic>{
  'id': instance.id,
  'username': instance.username,
  'displayName': instance.displayName,
  'avatarUrl': instance.avatarUrl,
  'isAnonymous': instance.isAnonymous,
};
