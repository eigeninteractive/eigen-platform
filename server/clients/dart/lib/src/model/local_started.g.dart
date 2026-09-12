// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'local_started.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LocalStarted _$LocalStartedFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LocalStarted', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['session']);
      final val = LocalStarted(
        session: $checkedConvert(
          'session',
          (v) => Session.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$LocalStartedToJson(LocalStarted instance) =>
    <String, dynamic>{'session': instance.session.toJson()};
