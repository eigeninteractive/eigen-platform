// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'join.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Join _$JoinFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Join', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['clientSchemaVersion']);
      final val = Join(
        clientSchemaVersion: $checkedConvert(
          'clientSchemaVersion',
          (v) => (v as num).toInt(),
        ),
        commandId: $checkedConvert('commandId', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$JoinToJson(Join instance) => <String, dynamic>{
  'clientSchemaVersion': instance.clientSchemaVersion,
  'commandId': ?instance.commandId,
};
