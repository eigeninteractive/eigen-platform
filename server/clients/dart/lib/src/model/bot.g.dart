// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bot.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Bot _$BotFromJson(Map<String, dynamic> json) => $checkedCreate('Bot', json, (
  $checkedConvert,
) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'username',
      'displayName',
      'avatarUrl',
      'schemaVersion',
      'type',
      'ratedEligible',
      'config',
    ],
  );
  final val = Bot(
    id: $checkedConvert('id', (v) => v as String),
    username: $checkedConvert('username', (v) => v as String),
    displayName: $checkedConvert('displayName', (v) => v as String),
    avatarUrl: $checkedConvert('avatarUrl', (v) => v as String?),
    schemaVersion: $checkedConvert('schemaVersion', (v) => (v as num).toInt()),
    type: $checkedConvert(
      'type',
      (v) => $enumDecode(
        _$BotTypeEnumMap,
        v,
        unknownValue: BotType.unknownDefaultOpenApi,
      ),
    ),
    ratedEligible: $checkedConvert('ratedEligible', (v) => v as bool),
    config: $checkedConvert('config', (v) => v as Object),
  );
  return val;
});

Map<String, dynamic> _$BotToJson(Bot instance) => <String, dynamic>{
  'id': instance.id,
  'username': instance.username,
  'displayName': instance.displayName,
  'avatarUrl': instance.avatarUrl,
  'schemaVersion': instance.schemaVersion,
  'type': _$BotTypeEnumMap[instance.type]!,
  'ratedEligible': instance.ratedEligible,
  'config': instance.config,
};

const _$BotTypeEnumMap = {
  BotType.engine: 'engine',
  BotType.external_: 'external',
  BotType.local: 'local',
  BotType.unknownDefaultOpenApi: 'unknown_default_open_api',
};
