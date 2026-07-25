// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rating_history_entry.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RatingHistoryEntry _$RatingHistoryEntryFromJson(Map<String, dynamic> json) =>
    $checkedCreate(
      'RatingHistoryEntry',
      json,
      ($checkedConvert) {
        $checkKeys(
          json,
          requiredKeys: const [
            'game_id',
            'pool',
            'display_before',
            'display_after',
            'display_change',
            'created_at',
          ],
        );
        final val = RatingHistoryEntry(
          gameId: $checkedConvert('game_id', (v) => v as String),
          pool: $checkedConvert('pool', (v) => v as String),
          displayBefore: $checkedConvert(
            'display_before',
            (v) => (v as num).toInt(),
          ),
          displayAfter: $checkedConvert(
            'display_after',
            (v) => (v as num).toInt(),
          ),
          displayChange: $checkedConvert(
            'display_change',
            (v) => (v as num).toInt(),
          ),
          createdAt: $checkedConvert('created_at', (v) => (v as num).toInt()),
        );
        return val;
      },
      fieldKeyMap: const {
        'gameId': 'game_id',
        'displayBefore': 'display_before',
        'displayAfter': 'display_after',
        'displayChange': 'display_change',
        'createdAt': 'created_at',
      },
    );

Map<String, dynamic> _$RatingHistoryEntryToJson(RatingHistoryEntry instance) =>
    <String, dynamic>{
      'game_id': instance.gameId,
      'pool': instance.pool,
      'display_before': instance.displayBefore,
      'display_after': instance.displayAfter,
      'display_change': instance.displayChange,
      'created_at': instance.createdAt,
    };
