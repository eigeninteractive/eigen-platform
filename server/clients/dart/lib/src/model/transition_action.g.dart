// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'transition_action.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TransitionAction _$TransitionActionFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('TransitionAction', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['type', 'kind', 'data', 'playerIndex']);
  final val = TransitionAction(
    type: $checkedConvert(
      'type',
      (v) => $enumDecode(
        _$TransitionActionTypeEnumEnumMap,
        v,
        unknownValue: TransitionActionTypeEnum.unknownDefaultOpenApi,
      ),
    ),
    kind: $checkedConvert(
      'kind',
      (v) => $enumDecode(
        _$TransitionActionKindEnumEnumMap,
        v,
        unknownValue: TransitionActionKindEnum.unknownDefaultOpenApi,
      ),
    ),
    data: $checkedConvert('data', (v) => v as Object),
    playerIndex: $checkedConvert('playerIndex', (v) => (v as num?)?.toInt()),
  );
  return val;
});

Map<String, dynamic> _$TransitionActionToJson(TransitionAction instance) =>
    <String, dynamic>{
      'type': _$TransitionActionTypeEnumEnumMap[instance.type]!,
      'kind': _$TransitionActionKindEnumEnumMap[instance.kind]!,
      'data': instance.data,
      'playerIndex': instance.playerIndex,
    };

const _$TransitionActionTypeEnumEnumMap = {
  TransitionActionTypeEnum.user: 'user',
  TransitionActionTypeEnum.bot: 'bot',
  TransitionActionTypeEnum.system: 'system',
  TransitionActionTypeEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$TransitionActionKindEnumEnumMap = {
  TransitionActionKindEnum.game: 'game',
  TransitionActionKindEnum.lifecycle: 'lifecycle',
  TransitionActionKindEnum.ratings: 'ratings',
  TransitionActionKindEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
