// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rating_delta.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RatingDelta _$RatingDeltaFromJson(Map<String, dynamic> json) => $checkedCreate(
  'RatingDelta',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const [
        'identity',
        'pool',
        'mu_before',
        'sigma_before',
        'display_before',
        'mu_after',
        'sigma_after',
        'display_after',
        'display_change',
      ],
    );
    final val = RatingDelta(
      identity: $checkedConvert(
        'identity',
        (v) => RatingIdentity.fromJson(v as Map<String, dynamic>),
      ),
      pool: $checkedConvert('pool', (v) => v as String),
      muBefore: $checkedConvert('mu_before', (v) => v as num),
      sigmaBefore: $checkedConvert('sigma_before', (v) => v as num),
      displayBefore: $checkedConvert(
        'display_before',
        (v) => (v as num).toInt(),
      ),
      muAfter: $checkedConvert('mu_after', (v) => v as num),
      sigmaAfter: $checkedConvert('sigma_after', (v) => v as num),
      displayAfter: $checkedConvert('display_after', (v) => (v as num).toInt()),
      displayChange: $checkedConvert(
        'display_change',
        (v) => (v as num).toInt(),
      ),
    );
    return val;
  },
  fieldKeyMap: const {
    'muBefore': 'mu_before',
    'sigmaBefore': 'sigma_before',
    'displayBefore': 'display_before',
    'muAfter': 'mu_after',
    'sigmaAfter': 'sigma_after',
    'displayAfter': 'display_after',
    'displayChange': 'display_change',
  },
);

Map<String, dynamic> _$RatingDeltaToJson(RatingDelta instance) =>
    <String, dynamic>{
      'identity': instance.identity.toJson(),
      'pool': instance.pool,
      'mu_before': instance.muBefore,
      'sigma_before': instance.sigmaBefore,
      'display_before': instance.displayBefore,
      'mu_after': instance.muAfter,
      'sigma_after': instance.sigmaAfter,
      'display_after': instance.displayAfter,
      'display_change': instance.displayChange,
    };
