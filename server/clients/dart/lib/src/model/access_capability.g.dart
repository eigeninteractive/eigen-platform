// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'access_capability.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AccessCapability _$AccessCapabilityFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AccessCapability', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['kind']);
      final val = AccessCapability(
        kind: $checkedConvert(
          'kind',
          (v) => $enumDecode(
            _$AccessCapabilityKindEnumEnumMap,
            v,
            unknownValue: AccessCapabilityKindEnum.unknownDefaultOpenApi,
          ),
        ),
        access: $checkedConvert(
          'access',
          (v) => $enumDecodeNullable(
            _$AccessCapabilityAccessEnumEnumMap,
            v,
            unknownValue: AccessCapabilityAccessEnum.unknownDefaultOpenApi,
          ),
        ),
        tier: $checkedConvert('tier', (v) => v as String?),
        collection: $checkedConvert('collection', (v) => v as String?),
        id: $checkedConvert('id', (v) => v as String?),
        analysisType: $checkedConvert('analysisType', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$AccessCapabilityToJson(AccessCapability instance) =>
    <String, dynamic>{
      'kind': _$AccessCapabilityKindEnumEnumMap[instance.kind]!,
      'access': ?_$AccessCapabilityAccessEnumEnumMap[instance.access],
      'tier': ?instance.tier,
      'collection': ?instance.collection,
      'id': ?instance.id,
      'analysisType': ?instance.analysisType,
    };

const _$AccessCapabilityKindEnumEnumMap = {
  AccessCapabilityKindEnum.appPeriodAccess: 'app.access',
  AccessCapabilityKindEnum.gamePeriodCreate: 'game.create',
  AccessCapabilityKindEnum.gamePeriodJoin: 'game.join',
  AccessCapabilityKindEnum.gamePeriodCreatePeriodRated: 'game.create.rated',
  AccessCapabilityKindEnum.botPeriodUse: 'bot.use',
  AccessCapabilityKindEnum.contentPeriodUse: 'content.use',
  AccessCapabilityKindEnum.replayPeriodRead: 'replay.read',
  AccessCapabilityKindEnum.analysisPeriodUse: 'analysis.use',
  AccessCapabilityKindEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$AccessCapabilityAccessEnumEnumMap = {
  AccessCapabilityAccessEnum.public: 'public',
  AccessCapabilityAccessEnum.private: 'private',
  AccessCapabilityAccessEnum.friends: 'friends',
  AccessCapabilityAccessEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
