// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'outcome.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Outcome _$OutcomeFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Outcome', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['playerIndex', 'result', 'placement', 'teamIndex'],
      );
      final val = Outcome(
        playerIndex: $checkedConvert('playerIndex', (v) => (v as num).toInt()),
        result: $checkedConvert(
          'result',
          (v) => $enumDecode(_$OutcomeResultEnumEnumMap, v),
        ),
        placement: $checkedConvert('placement', (v) => (v as num).toInt()),
        teamIndex: $checkedConvert('teamIndex', (v) => (v as num).toInt()),
        score: $checkedConvert('score', (v) => v as num?),
      );
      return val;
    });

Map<String, dynamic> _$OutcomeToJson(Outcome instance) => <String, dynamic>{
  'playerIndex': instance.playerIndex,
  'result': _$OutcomeResultEnumEnumMap[instance.result]!,
  'placement': instance.placement,
  'teamIndex': instance.teamIndex,
  'score': ?instance.score,
};

const _$OutcomeResultEnumEnumMap = {
  OutcomeResultEnum.win: 'win',
  OutcomeResultEnum.loss: 'loss',
  OutcomeResultEnum.draw: 'draw',
  OutcomeResultEnum.eliminated: 'eliminated',
};
