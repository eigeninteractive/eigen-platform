// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'friends_games.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FriendsGames _$FriendsGamesFromJson(Map<String, dynamic> json) =>
    $checkedCreate('FriendsGames', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['games']);
      final val = FriendsGames(
        games: $checkedConvert(
          'games',
          (v) => (v as List<dynamic>)
              .map((e) => GameSummary.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$FriendsGamesToJson(FriendsGames instance) =>
    <String, dynamic>{'games': instance.games.map((e) => e.toJson()).toList()};
