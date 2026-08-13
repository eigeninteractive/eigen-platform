// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'device_registration.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

DeviceRegistration _$DeviceRegistrationFromJson(Map<String, dynamic> json) =>
    $checkedCreate('DeviceRegistration', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['fid', 'platform']);
      final val = DeviceRegistration(
        fid: $checkedConvert('fid', (v) => v as String),
        platform: $checkedConvert(
          'platform',
          (v) => $enumDecode(
            _$DeviceRegistrationPlatformEnumEnumMap,
            v,
            unknownValue: DeviceRegistrationPlatformEnum.unknownDefaultOpenApi,
          ),
        ),
      );
      return val;
    });

Map<String, dynamic> _$DeviceRegistrationToJson(DeviceRegistration instance) =>
    <String, dynamic>{
      'fid': instance.fid,
      'platform': _$DeviceRegistrationPlatformEnumEnumMap[instance.platform]!,
    };

const _$DeviceRegistrationPlatformEnumEnumMap = {
  DeviceRegistrationPlatformEnum.ios: 'ios',
  DeviceRegistrationPlatformEnum.android: 'android',
  DeviceRegistrationPlatformEnum.web: 'web',
  DeviceRegistrationPlatformEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
