// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rating_delta.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RatingDelta _$RatingDeltaFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RatingDelta', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'identity',
      'pool',
      'muBefore',
      'sigmaBefore',
      'displayBefore',
      'muAfter',
      'sigmaAfter',
      'displayAfter',
      'displayChange',
    ],
  );
  final val = RatingDelta(
    identity: $checkedConvert(
      'identity',
      (v) => RatingIdentity.fromJson(v as Map<String, dynamic>),
    ),
    pool: $checkedConvert('pool', (v) => v as String),
    muBefore: $checkedConvert('muBefore', (v) => v as num),
    sigmaBefore: $checkedConvert('sigmaBefore', (v) => v as num),
    displayBefore: $checkedConvert('displayBefore', (v) => (v as num).toInt()),
    muAfter: $checkedConvert('muAfter', (v) => v as num),
    sigmaAfter: $checkedConvert('sigmaAfter', (v) => v as num),
    displayAfter: $checkedConvert('displayAfter', (v) => (v as num).toInt()),
    displayChange: $checkedConvert('displayChange', (v) => (v as num).toInt()),
  );
  return val;
});

Map<String, dynamic> _$RatingDeltaToJson(RatingDelta instance) =>
    <String, dynamic>{
      'identity': instance.identity.toJson(),
      'pool': instance.pool,
      'muBefore': instance.muBefore,
      'sigmaBefore': instance.sigmaBefore,
      'displayBefore': instance.displayBefore,
      'muAfter': instance.muAfter,
      'sigmaAfter': instance.sigmaAfter,
      'displayAfter': instance.displayAfter,
      'displayChange': instance.displayChange,
    };
