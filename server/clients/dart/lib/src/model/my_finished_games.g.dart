// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'my_finished_games.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MyFinishedGames _$MyFinishedGamesFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MyFinishedGames', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['games', 'nextCursor']);
      final val = MyFinishedGames(
        games: $checkedConvert(
          'games',
          (v) => (v as List<dynamic>)
              .map((e) => GameSummary.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        nextCursor: $checkedConvert('nextCursor', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$MyFinishedGamesToJson(MyFinishedGames instance) =>
    <String, dynamic>{
      'games': instance.games.map((e) => e.toJson()).toList(),
      'nextCursor': instance.nextCursor,
    };
