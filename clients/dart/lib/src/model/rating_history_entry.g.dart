// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rating_history_entry.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RatingHistoryEntry _$RatingHistoryEntryFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RatingHistoryEntry', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'gameId',
      'pool',
      'displayBefore',
      'displayAfter',
      'displayChange',
      'createdAt',
    ],
  );
  final val = RatingHistoryEntry(
    gameId: $checkedConvert('gameId', (v) => v as String),
    pool: $checkedConvert('pool', (v) => v as String),
    displayBefore: $checkedConvert('displayBefore', (v) => (v as num).toInt()),
    displayAfter: $checkedConvert('displayAfter', (v) => (v as num).toInt()),
    displayChange: $checkedConvert('displayChange', (v) => (v as num).toInt()),
    createdAt: $checkedConvert('createdAt', (v) => (v as num).toInt()),
  );
  return val;
});

Map<String, dynamic> _$RatingHistoryEntryToJson(RatingHistoryEntry instance) =>
    <String, dynamic>{
      'gameId': instance.gameId,
      'pool': instance.pool,
      'displayBefore': instance.displayBefore,
      'displayAfter': instance.displayAfter,
      'displayChange': instance.displayChange,
      'createdAt': instance.createdAt,
    };
