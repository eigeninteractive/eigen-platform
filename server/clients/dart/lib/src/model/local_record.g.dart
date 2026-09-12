// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'local_record.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LocalRecord _$LocalRecordFromJson(Map<String, dynamic> json) => $checkedCreate(
  'LocalRecord',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const [
        'session',
        'seed',
        'createdAt',
        'finishedAt',
        'transitions',
      ],
    );
    final val = LocalRecord(
      session: $checkedConvert(
        'session',
        (v) => Session.fromJson(v as Map<String, dynamic>),
      ),
      seed: $checkedConvert('seed', (v) => v as String),
      createdAt: $checkedConvert('createdAt', (v) => (v as num).toInt()),
      finishedAt: $checkedConvert('finishedAt', (v) => (v as num?)?.toInt()),
      transitions: $checkedConvert(
        'transitions',
        (v) => (v as List<dynamic>)
            .map((e) => LocalTransitionRow.fromJson(e as Map<String, dynamic>))
            .toList(),
      ),
    );
    return val;
  },
);

Map<String, dynamic> _$LocalRecordToJson(LocalRecord instance) =>
    <String, dynamic>{
      'session': instance.session.toJson(),
      'seed': instance.seed,
      'createdAt': instance.createdAt,
      'finishedAt': instance.finishedAt,
      'transitions': instance.transitions.map((e) => e.toJson()).toList(),
    };
