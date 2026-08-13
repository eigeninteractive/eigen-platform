// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lobby.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Lobby _$LobbyFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Lobby', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['games', 'nextCursor']);
      final val = Lobby(
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

Map<String, dynamic> _$LobbyToJson(Lobby instance) => <String, dynamic>{
  'games': instance.games.map((e) => e.toJson()).toList(),
  'nextCursor': instance.nextCursor,
};
