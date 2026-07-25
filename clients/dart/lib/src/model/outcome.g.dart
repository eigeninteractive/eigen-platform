// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'outcome.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Outcome _$OutcomeFromJson(Map<String, dynamic> json) => $checkedCreate(
  'Outcome',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const ['player_index', 'result', 'placement', 'team_index'],
    );
    final val = Outcome(
      playerIndex: $checkedConvert('player_index', (v) => (v as num).toInt()),
      result: $checkedConvert(
        'result',
        (v) => $enumDecode(_$OutcomeResultEnumEnumMap, v),
      ),
      placement: $checkedConvert('placement', (v) => (v as num).toInt()),
      teamIndex: $checkedConvert('team_index', (v) => (v as num).toInt()),
      score: $checkedConvert('score', (v) => v as num?),
    );
    return val;
  },
  fieldKeyMap: const {'playerIndex': 'player_index', 'teamIndex': 'team_index'},
);

Map<String, dynamic> _$OutcomeToJson(Outcome instance) => <String, dynamic>{
  'player_index': instance.playerIndex,
  'result': _$OutcomeResultEnumEnumMap[instance.result]!,
  'placement': instance.placement,
  'team_index': instance.teamIndex,
  'score': ?instance.score,
};

const _$OutcomeResultEnumEnumMap = {
  OutcomeResultEnum.win: 'win',
  OutcomeResultEnum.loss: 'loss',
  OutcomeResultEnum.draw: 'draw',
  OutcomeResultEnum.eliminated: 'eliminated',
};
