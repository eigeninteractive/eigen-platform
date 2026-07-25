// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'add_bot.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AddBot _$AddBotFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AddBot', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['bot_id']);
      final val = AddBot(
        botId: $checkedConvert('bot_id', (v) => v as String),
        commandId: $checkedConvert('command_id', (v) => v as String?),
      );
      return val;
    }, fieldKeyMap: const {'botId': 'bot_id', 'commandId': 'command_id'});

Map<String, dynamic> _$AddBotToJson(AddBot instance) => <String, dynamic>{
  'bot_id': instance.botId,
  'command_id': ?instance.commandId,
};
