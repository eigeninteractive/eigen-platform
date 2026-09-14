// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'commerce_product.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CommerceProduct _$CommerceProductFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CommerceProduct', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'provider',
          'providerReference',
          'displayPrice',
          'currencyCode',
        ],
      );
      final val = CommerceProduct(
        provider: $checkedConvert('provider', (v) => v as String),
        providerReference: $checkedConvert(
          'providerReference',
          (v) => v as String,
        ),
        displayPrice: $checkedConvert('displayPrice', (v) => v as String?),
        currencyCode: $checkedConvert('currencyCode', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$CommerceProductToJson(CommerceProduct instance) =>
    <String, dynamic>{
      'provider': instance.provider,
      'providerReference': instance.providerReference,
      'displayPrice': instance.displayPrice,
      'currencyCode': instance.currencyCode,
    };
