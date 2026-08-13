// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'solo_started.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SoloStarted _$SoloStartedFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SoloStarted', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['session']);
      final val = SoloStarted(
        session: $checkedConvert(
          'session',
          (v) => Session.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SoloStartedToJson(SoloStarted instance) =>
    <String, dynamic>{'session': instance.session.toJson()};
