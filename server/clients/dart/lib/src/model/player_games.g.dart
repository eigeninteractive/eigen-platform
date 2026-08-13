// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'player_games.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PlayerGames _$PlayerGamesFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PlayerGames', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['games', 'nextCursor']);
      final val = PlayerGames(
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

Map<String, dynamic> _$PlayerGamesToJson(PlayerGames instance) =>
    <String, dynamic>{
      'games': instance.games.map((e) => e.toJson()).toList(),
      'nextCursor': instance.nextCursor,
    };
