// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'player_games.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PlayerGames _$PlayerGamesFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PlayerGames', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['games']);
      final val = PlayerGames(
        games: $checkedConvert(
          'games',
          (v) => (v as List<dynamic>)
              .map((e) => GameSummary.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$PlayerGamesToJson(PlayerGames instance) =>
    <String, dynamic>{'games': instance.games.map((e) => e.toJson()).toList()};
