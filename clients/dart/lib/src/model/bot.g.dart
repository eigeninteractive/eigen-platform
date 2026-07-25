// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bot.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Bot _$BotFromJson(Map<String, dynamic> json) => $checkedCreate(
  'Bot',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const [
        'id',
        'username',
        'display_name',
        'avatar_url',
        'schema_version',
        'rated_eligible',
        'config',
      ],
    );
    final val = Bot(
      id: $checkedConvert('id', (v) => v as String),
      username: $checkedConvert('username', (v) => v as String),
      displayName: $checkedConvert('display_name', (v) => v as String),
      avatarUrl: $checkedConvert('avatar_url', (v) => v as String?),
      schemaVersion: $checkedConvert(
        'schema_version',
        (v) => (v as num).toInt(),
      ),
      ratedEligible: $checkedConvert('rated_eligible', (v) => v as bool),
      config: $checkedConvert('config', (v) => v as Object),
    );
    return val;
  },
  fieldKeyMap: const {
    'displayName': 'display_name',
    'avatarUrl': 'avatar_url',
    'schemaVersion': 'schema_version',
    'ratedEligible': 'rated_eligible',
  },
);

Map<String, dynamic> _$BotToJson(Bot instance) => <String, dynamic>{
  'id': instance.id,
  'username': instance.username,
  'display_name': instance.displayName,
  'avatar_url': instance.avatarUrl,
  'schema_version': instance.schemaVersion,
  'rated_eligible': instance.ratedEligible,
  'config': instance.config,
};
