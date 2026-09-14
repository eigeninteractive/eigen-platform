// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'commerce_catalog.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CommerceCatalog _$CommerceCatalogFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CommerceCatalog', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['offers']);
      final val = CommerceCatalog(
        offers: $checkedConvert(
          'offers',
          (v) => (v as List<dynamic>)
              .map((e) => CommerceOffer.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$CommerceCatalogToJson(CommerceCatalog instance) =>
    <String, dynamic>{
      'offers': instance.offers.map((e) => e.toJson()).toList(),
    };
