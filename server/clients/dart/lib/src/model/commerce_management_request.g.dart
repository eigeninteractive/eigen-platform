// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'commerce_management_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CommerceManagementRequest _$CommerceManagementRequestFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CommerceManagementRequest', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['provider', 'returnUrl']);
  final val = CommerceManagementRequest(
    provider: $checkedConvert('provider', (v) => v as String),
    returnUrl: $checkedConvert('returnUrl', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$CommerceManagementRequestToJson(
  CommerceManagementRequest instance,
) => <String, dynamic>{
  'provider': instance.provider,
  'returnUrl': instance.returnUrl,
};
