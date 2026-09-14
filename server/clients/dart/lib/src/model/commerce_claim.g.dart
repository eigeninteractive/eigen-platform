// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'commerce_claim.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CommerceClaim _$CommerceClaimFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CommerceClaim', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['provider', 'offerKey', 'evidence']);
  final val = CommerceClaim(
    provider: $checkedConvert('provider', (v) => v as String),
    offerKey: $checkedConvert('offerKey', (v) => v as String),
    evidence: $checkedConvert(
      'evidence',
      (v) =>
          (v as Map<String, dynamic>).map((k, e) => MapEntry(k, e as Object)),
    ),
  );
  return val;
});

Map<String, dynamic> _$CommerceClaimToJson(CommerceClaim instance) =>
    <String, dynamic>{
      'provider': instance.provider,
      'offerKey': instance.offerKey,
      'evidence': instance.evidence,
    };
