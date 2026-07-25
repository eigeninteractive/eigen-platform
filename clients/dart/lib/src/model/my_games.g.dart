// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'my_games.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MyGames _$MyGamesFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MyGames', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['games']);
      final val = MyGames(
        games: $checkedConvert(
          'games',
          (v) => (v as List<dynamic>)
              .map((e) => GameSummary.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$MyGamesToJson(MyGames instance) => <String, dynamic>{
  'games': instance.games.map((e) => e.toJson()).toList(),
};
