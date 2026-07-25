// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bot_action.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BotAction _$BotActionFromJson(Map<String, dynamic> json) => $checkedCreate(
  'BotAction',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const ['bot_id', 'game_id', 'player_index', 'version'],
    );
    final val = BotAction(
      botId: $checkedConvert('bot_id', (v) => v as String),
      gameId: $checkedConvert('game_id', (v) => v as String),
      playerIndex: $checkedConvert('player_index', (v) => (v as num).toInt()),
      version: $checkedConvert('version', (v) => (v as num).toInt()),
      data: $checkedConvert('data', (v) => v),
    );
    return val;
  },
  fieldKeyMap: const {
    'botId': 'bot_id',
    'gameId': 'game_id',
    'playerIndex': 'player_index',
  },
);

Map<String, dynamic> _$BotActionToJson(BotAction instance) => <String, dynamic>{
  'bot_id': instance.botId,
  'game_id': instance.gameId,
  'player_index': instance.playerIndex,
  'version': instance.version,
  'data': ?instance.data,
};
