// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'commerce_checkout_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CommerceCheckoutRequest _$CommerceCheckoutRequestFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CommerceCheckoutRequest', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['provider', 'offerKey', 'returnUrl', 'operationId'],
  );
  final val = CommerceCheckoutRequest(
    provider: $checkedConvert('provider', (v) => v as String),
    offerKey: $checkedConvert('offerKey', (v) => v as String),
    returnUrl: $checkedConvert('returnUrl', (v) => v as String),
    operationId: $checkedConvert('operationId', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$CommerceCheckoutRequestToJson(
  CommerceCheckoutRequest instance,
) => <String, dynamic>{
  'provider': instance.provider,
  'offerKey': instance.offerKey,
  'returnUrl': instance.returnUrl,
  'operationId': instance.operationId,
};
