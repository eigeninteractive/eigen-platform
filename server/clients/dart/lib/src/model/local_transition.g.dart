// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'local_transition.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LocalTransition _$LocalTransitionFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LocalTransition', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['seat', 'kind']);
      final val = LocalTransition(
        seat: $checkedConvert('seat', (v) => (v as num).toInt()),
        kind: $checkedConvert(
          'kind',
          (v) => $enumDecode(
            _$LocalTransitionKindEnumEnumMap,
            v,
            unknownValue: LocalTransitionKindEnum.unknownDefaultOpenApi,
          ),
        ),
        data: $checkedConvert('data', (v) => v),
      );
      return val;
    });

Map<String, dynamic> _$LocalTransitionToJson(LocalTransition instance) =>
    <String, dynamic>{
      'seat': instance.seat,
      'kind': _$LocalTransitionKindEnumEnumMap[instance.kind]!,
      'data': ?instance.data,
    };

const _$LocalTransitionKindEnumEnumMap = {
  LocalTransitionKindEnum.game: 'game',
  LocalTransitionKindEnum.lifecycle: 'lifecycle',
  LocalTransitionKindEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
