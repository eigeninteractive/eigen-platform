// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'join.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Join _$JoinFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Join', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['clientSchemaVersions']);
      final val = Join(
        clientSchemaVersions: $checkedConvert(
          'clientSchemaVersions',
          (v) => (v as List<dynamic>).map((e) => (e as num).toInt()).toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$JoinToJson(Join instance) => <String, dynamic>{
  'clientSchemaVersions': instance.clientSchemaVersions,
};
