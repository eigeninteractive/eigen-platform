// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'commercial_limit_access.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CommercialLimitAccess _$CommercialLimitAccessFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CommercialLimitAccess', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'metric',
      'maximum',
      'noCommercialLimit',
      'period',
      'used',
      'remaining',
      'resetsAt',
    ],
  );
  final val = CommercialLimitAccess(
    metric: $checkedConvert(
      'metric',
      (v) => $enumDecode(
        _$CommercialLimitAccessMetricEnumEnumMap,
        v,
        unknownValue: CommercialLimitAccessMetricEnum.unknownDefaultOpenApi,
      ),
    ),
    maximum: $checkedConvert('maximum', (v) => (v as num?)?.toInt()),
    noCommercialLimit: $checkedConvert('noCommercialLimit', (v) => v as bool),
    period: $checkedConvert(
      'period',
      (v) => $enumDecodeNullable(
        _$CommercialPeriodKindEnumMap,
        v,
        unknownValue: CommercialPeriodKind.unknownDefaultOpenApi,
      ),
    ),
    used: $checkedConvert('used', (v) => (v as num).toInt()),
    remaining: $checkedConvert('remaining', (v) => (v as num?)?.toInt()),
    resetsAt: $checkedConvert('resetsAt', (v) => (v as num?)?.toInt()),
  );
  return val;
});

Map<String, dynamic> _$CommercialLimitAccessToJson(
  CommercialLimitAccess instance,
) => <String, dynamic>{
  'metric': _$CommercialLimitAccessMetricEnumEnumMap[instance.metric]!,
  'maximum': instance.maximum,
  'noCommercialLimit': instance.noCommercialLimit,
  'period': _$CommercialPeriodKindEnumMap[instance.period],
  'used': instance.used,
  'remaining': instance.remaining,
  'resetsAt': instance.resetsAt,
};

const _$CommercialLimitAccessMetricEnumEnumMap = {
  CommercialLimitAccessMetricEnum.gamePeriodCreatePeriodSuccess:
      'game.create.success',
  CommercialLimitAccessMetricEnum.gamesPeriodOpenCreated: 'games.openCreated',
  CommercialLimitAccessMetricEnum.botPeriodGamePeriodSuccess:
      'bot.game.success',
  CommercialLimitAccessMetricEnum.analysisPeriodRunPeriodSuccess:
      'analysis.run.success',
  CommercialLimitAccessMetricEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};

const _$CommercialPeriodKindEnumMap = {
  CommercialPeriodKind.calendarMonth: 'calendarMonth',
  CommercialPeriodKind.subscriptionPeriod: 'subscriptionPeriod',
  CommercialPeriodKind.lifetime: 'lifetime',
  CommercialPeriodKind.concurrent: 'concurrent',
  CommercialPeriodKind.unknownDefaultOpenApi: 'unknown_default_open_api',
};
