// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'local_transitions_applied.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LocalTransitionsApplied _$LocalTransitionsAppliedFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('LocalTransitionsApplied', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['applied', 'session', 'rejection']);
  final val = LocalTransitionsApplied(
    applied: $checkedConvert('applied', (v) => (v as num).toInt()),
    session: $checkedConvert(
      'session',
      (v) => Session.fromJson(v as Map<String, dynamic>),
    ),
    rejection: $checkedConvert(
      'rejection',
      (v) =>
          v == null ? null : LocalRejection.fromJson(v as Map<String, dynamic>),
    ),
  );
  return val;
});

Map<String, dynamic> _$LocalTransitionsAppliedToJson(
  LocalTransitionsApplied instance,
) => <String, dynamic>{
  'applied': instance.applied,
  'session': instance.session.toJson(),
  'rejection': instance.rejection?.toJson(),
};
