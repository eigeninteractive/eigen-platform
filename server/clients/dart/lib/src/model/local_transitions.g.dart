// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'local_transitions.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LocalTransitions _$LocalTransitionsFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LocalTransitions', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['fromVersion', 'transitions']);
      final val = LocalTransitions(
        fromVersion: $checkedConvert('fromVersion', (v) => (v as num).toInt()),
        transitions: $checkedConvert(
          'transitions',
          (v) => (v as List<dynamic>)
              .map((e) => LocalTransition.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$LocalTransitionsToJson(LocalTransitions instance) =>
    <String, dynamic>{
      'fromVersion': instance.fromVersion,
      'transitions': instance.transitions.map((e) => e.toJson()).toList(),
    };
