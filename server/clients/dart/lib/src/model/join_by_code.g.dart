// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'join_by_code.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

JoinByCode _$JoinByCodeFromJson(Map<String, dynamic> json) => $checkedCreate(
  'JoinByCode',
  json,
  ($checkedConvert) {
    $checkKeys(json, requiredKeys: const ['clientSchemaVersions', 'shortCode']);
    final val = JoinByCode(
      clientSchemaVersions: $checkedConvert(
        'clientSchemaVersions',
        (v) => (v as List<dynamic>).map((e) => (e as num).toInt()).toList(),
      ),
      shortCode: $checkedConvert('shortCode', (v) => v as String),
    );
    return val;
  },
);

Map<String, dynamic> _$JoinByCodeToJson(JoinByCode instance) =>
    <String, dynamic>{
      'clientSchemaVersions': instance.clientSchemaVersions,
      'shortCode': instance.shortCode,
    };
