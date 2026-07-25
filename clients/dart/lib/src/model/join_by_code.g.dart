// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'join_by_code.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

JoinByCode _$JoinByCodeFromJson(Map<String, dynamic> json) => $checkedCreate(
  'JoinByCode',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const ['client_schema_version', 'short_code'],
    );
    final val = JoinByCode(
      clientSchemaVersion: $checkedConvert(
        'client_schema_version',
        (v) => (v as num).toInt(),
      ),
      commandId: $checkedConvert('command_id', (v) => v as String?),
      shortCode: $checkedConvert('short_code', (v) => v as String),
    );
    return val;
  },
  fieldKeyMap: const {
    'clientSchemaVersion': 'client_schema_version',
    'commandId': 'command_id',
    'shortCode': 'short_code',
  },
);

Map<String, dynamic> _$JoinByCodeToJson(JoinByCode instance) =>
    <String, dynamic>{
      'client_schema_version': instance.clientSchemaVersion,
      'command_id': ?instance.commandId,
      'short_code': instance.shortCode,
    };
