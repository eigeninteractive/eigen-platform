// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'player.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Player _$PlayerFromJson(Map<String, dynamic> json) => $checkedCreate(
  'Player',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const [
        'id',
        'username',
        'display_name',
        'avatar_url',
        'is_anonymous',
      ],
    );
    final val = Player(
      id: $checkedConvert('id', (v) => v as String),
      username: $checkedConvert('username', (v) => v as String),
      displayName: $checkedConvert('display_name', (v) => v as String),
      avatarUrl: $checkedConvert('avatar_url', (v) => v as String?),
      isAnonymous: $checkedConvert('is_anonymous', (v) => v as bool),
    );
    return val;
  },
  fieldKeyMap: const {
    'displayName': 'display_name',
    'avatarUrl': 'avatar_url',
    'isAnonymous': 'is_anonymous',
  },
);

Map<String, dynamic> _$PlayerToJson(Player instance) => <String, dynamic>{
  'id': instance.id,
  'username': instance.username,
  'display_name': instance.displayName,
  'avatar_url': instance.avatarUrl,
  'is_anonymous': instance.isAnonymous,
};
