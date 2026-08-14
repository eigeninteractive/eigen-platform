// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'add_bot.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AddBot _$AddBotFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AddBot', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['botId']);
      final val = AddBot(botId: $checkedConvert('botId', (v) => v as String));
      return val;
    });

Map<String, dynamic> _$AddBotToJson(AddBot instance) => <String, dynamic>{
  'botId': instance.botId,
};
