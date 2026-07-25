// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rating.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Rating _$RatingFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('Rating', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['pool', 'mu', 'sigma', 'displayRating', 'updatedAt'],
  );
  final val = Rating(
    pool: $checkedConvert('pool', (v) => v as String),
    mu: $checkedConvert('mu', (v) => v as num),
    sigma: $checkedConvert('sigma', (v) => v as num),
    displayRating: $checkedConvert('displayRating', (v) => (v as num).toInt()),
    updatedAt: $checkedConvert('updatedAt', (v) => (v as num).toInt()),
  );
  return val;
});

Map<String, dynamic> _$RatingToJson(Rating instance) => <String, dynamic>{
  'pool': instance.pool,
  'mu': instance.mu,
  'sigma': instance.sigma,
  'displayRating': instance.displayRating,
  'updatedAt': instance.updatedAt,
};
