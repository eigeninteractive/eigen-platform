// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'join_by_code.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

JoinByCode _$JoinByCodeFromJson(Map<String, dynamic> json) => $checkedCreate(
  'JoinByCode',
  json,
  ($checkedConvert) {
    $checkKeys(json, requiredKeys: const ['clientSchemaVersion', 'shortCode']);
    final val = JoinByCode(
      clientSchemaVersion: $checkedConvert(
        'clientSchemaVersion',
        (v) => (v as num).toInt(),
      ),
      shortCode: $checkedConvert('shortCode', (v) => v as String),
    );
    return val;
  },
);

Map<String, dynamic> _$JoinByCodeToJson(JoinByCode instance) =>
    <String, dynamic>{
      'clientSchemaVersion': instance.clientSchemaVersion,
      'shortCode': instance.shortCode,
    };
