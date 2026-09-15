// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'commerce_url.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CommerceUrl _$CommerceUrlFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CommerceUrl', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['url']);
      final val = CommerceUrl(url: $checkedConvert('url', (v) => v as String));
      return val;
    });

Map<String, dynamic> _$CommerceUrlToJson(CommerceUrl instance) =>
    <String, dynamic>{'url': instance.url};
