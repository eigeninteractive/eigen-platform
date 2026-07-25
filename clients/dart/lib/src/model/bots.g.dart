// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'bots.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Bots _$BotsFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Bots', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['bots']);
      final val = Bots(
        bots: $checkedConvert(
          'bots',
          (v) => (v as List<dynamic>)
              .map((e) => Bot.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$BotsToJson(Bots instance) => <String, dynamic>{
  'bots': instance.bots.map((e) => e.toJson()).toList(),
};
