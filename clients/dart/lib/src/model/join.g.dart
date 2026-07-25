// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'join.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Join _$JoinFromJson(Map<String, dynamic> json) => $checkedCreate(
  'Join',
  json,
  ($checkedConvert) {
    $checkKeys(json, requiredKeys: const ['client_schema_version']);
    final val = Join(
      clientSchemaVersion: $checkedConvert(
        'client_schema_version',
        (v) => (v as num).toInt(),
      ),
      commandId: $checkedConvert('command_id', (v) => v as String?),
    );
    return val;
  },
  fieldKeyMap: const {
    'clientSchemaVersion': 'client_schema_version',
    'commandId': 'command_id',
  },
);

Map<String, dynamic> _$JoinToJson(Join instance) => <String, dynamic>{
  'client_schema_version': instance.clientSchemaVersion,
  'command_id': ?instance.commandId,
};
