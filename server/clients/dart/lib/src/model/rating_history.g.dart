// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rating_history.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RatingHistory _$RatingHistoryFromJson(Map<String, dynamic> json) =>
    $checkedCreate('RatingHistory', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['history']);
      final val = RatingHistory(
        history: $checkedConvert(
          'history',
          (v) => (v as List<dynamic>)
              .map(
                (e) => RatingHistoryEntry.fromJson(e as Map<String, dynamic>),
              )
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$RatingHistoryToJson(RatingHistory instance) =>
    <String, dynamic>{
      'history': instance.history.map((e) => e.toJson()).toList(),
    };
