// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rating.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Rating _$RatingFromJson(Map<String, dynamic> json) => $checkedCreate(
  'Rating',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const [
        'pool',
        'mu',
        'sigma',
        'display_rating',
        'updated_at',
      ],
    );
    final val = Rating(
      pool: $checkedConvert('pool', (v) => v as String),
      mu: $checkedConvert('mu', (v) => v as num),
      sigma: $checkedConvert('sigma', (v) => v as num),
      displayRating: $checkedConvert(
        'display_rating',
        (v) => (v as num).toInt(),
      ),
      updatedAt: $checkedConvert('updated_at', (v) => (v as num).toInt()),
    );
    return val;
  },
  fieldKeyMap: const {
    'displayRating': 'display_rating',
    'updatedAt': 'updated_at',
  },
);

Map<String, dynamic> _$RatingToJson(Rating instance) => <String, dynamic>{
  'pool': instance.pool,
  'mu': instance.mu,
  'sigma': instance.sigma,
  'display_rating': instance.displayRating,
  'updated_at': instance.updatedAt,
};
