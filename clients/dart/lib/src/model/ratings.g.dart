// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ratings.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Ratings _$RatingsFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Ratings', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['ratings']);
      final val = Ratings(
        ratings: $checkedConvert(
          'ratings',
          (v) => (v as List<dynamic>)
              .map((e) => Rating.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$RatingsToJson(Ratings instance) => <String, dynamic>{
  'ratings': instance.ratings.map((e) => e.toJson()).toList(),
};
