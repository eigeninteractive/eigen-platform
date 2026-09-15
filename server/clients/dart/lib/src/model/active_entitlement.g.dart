// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'active_entitlement.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ActiveEntitlement _$ActiveEntitlementFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ActiveEntitlement', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['key', 'validFrom', 'validUntil']);
      final val = ActiveEntitlement(
        key: $checkedConvert('key', (v) => v as String),
        validFrom: $checkedConvert('validFrom', (v) => (v as num).toInt()),
        validUntil: $checkedConvert('validUntil', (v) => (v as num?)?.toInt()),
      );
      return val;
    });

Map<String, dynamic> _$ActiveEntitlementToJson(ActiveEntitlement instance) =>
    <String, dynamic>{
      'key': instance.key,
      'validFrom': instance.validFrom,
      'validUntil': instance.validUntil,
    };
