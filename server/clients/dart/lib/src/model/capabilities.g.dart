// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'capabilities.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Capabilities _$CapabilitiesFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Capabilities', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'creatableSchemaVersions',
          'supportedSchemaVersions',
        ],
      );
      final val = Capabilities(
        creatableSchemaVersions: $checkedConvert(
          'creatableSchemaVersions',
          (v) => (v as List<dynamic>).map((e) => (e as num).toInt()).toList(),
        ),
        supportedSchemaVersions: $checkedConvert(
          'supportedSchemaVersions',
          (v) => (v as List<dynamic>).map((e) => (e as num).toInt()).toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$CapabilitiesToJson(Capabilities instance) =>
    <String, dynamic>{
      'creatableSchemaVersions': instance.creatableSchemaVersions,
      'supportedSchemaVersions': instance.supportedSchemaVersions,
    };
