// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'commerce_offer.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CommerceOffer _$CommerceOfferFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CommerceOffer', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'key',
          'name',
          'description',
          'kind',
          'entitlements',
          'repeatable',
          'products',
        ],
      );
      final val = CommerceOffer(
        key: $checkedConvert('key', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        description: $checkedConvert('description', (v) => v as String),
        kind: $checkedConvert(
          'kind',
          (v) => $enumDecode(
            _$CommerceOfferKindEnumEnumMap,
            v,
            unknownValue: CommerceOfferKindEnum.unknownDefaultOpenApi,
          ),
        ),
        entitlements: $checkedConvert(
          'entitlements',
          (v) => (v as List<dynamic>).map((e) => e as String).toList(),
        ),
        repeatable: $checkedConvert('repeatable', (v) => v as bool),
        products: $checkedConvert(
          'products',
          (v) => (v as List<dynamic>)
              .map((e) => CommerceProduct.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$CommerceOfferToJson(CommerceOffer instance) =>
    <String, dynamic>{
      'key': instance.key,
      'name': instance.name,
      'description': instance.description,
      'kind': _$CommerceOfferKindEnumEnumMap[instance.kind]!,
      'entitlements': instance.entitlements,
      'repeatable': instance.repeatable,
      'products': instance.products.map((e) => e.toJson()).toList(),
    };

const _$CommerceOfferKindEnumEnumMap = {
  CommerceOfferKindEnum.oneTime: 'oneTime',
  CommerceOfferKindEnum.subscription: 'subscription',
  CommerceOfferKindEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
