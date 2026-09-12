// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'local_transition_row.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LocalTransitionRow _$LocalTransitionRowFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LocalTransitionRow', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['version', 'state', 'action', 'pending'],
      );
      final val = LocalTransitionRow(
        version: $checkedConvert('version', (v) => (v as num).toInt()),
        state: $checkedConvert('state', (v) => v as Object),
        action: $checkedConvert(
          'action',
          (v) => v == null
              ? null
              : TransitionAction.fromJson(v as Map<String, dynamic>),
        ),
        pending: $checkedConvert(
          'pending',
          (v) => (v as List<dynamic>).map((e) => (e as num).toInt()).toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$LocalTransitionRowToJson(LocalTransitionRow instance) =>
    <String, dynamic>{
      'version': instance.version,
      'state': instance.state,
      'action': instance.action?.toJson(),
      'pending': instance.pending,
    };
