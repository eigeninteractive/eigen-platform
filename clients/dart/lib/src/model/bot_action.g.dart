// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bot_action.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

BotAction _$BotActionFromJson(Map<String, dynamic> json) =>
    $checkedCreate('BotAction', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['botId', 'gameId', 'playerIndex', 'version'],
      );
      final val = BotAction(
        botId: $checkedConvert('botId', (v) => v as String),
        gameId: $checkedConvert('gameId', (v) => v as String),
        playerIndex: $checkedConvert('playerIndex', (v) => (v as num).toInt()),
        version: $checkedConvert('version', (v) => (v as num).toInt()),
        data: $checkedConvert('data', (v) => v),
      );
      return val;
    });

Map<String, dynamic> _$BotActionToJson(BotAction instance) => <String, dynamic>{
  'botId': instance.botId,
  'gameId': instance.gameId,
  'playerIndex': instance.playerIndex,
  'version': instance.version,
  'data': ?instance.data,
};
