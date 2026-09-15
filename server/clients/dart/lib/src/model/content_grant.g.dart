// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'content_grant.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ContentGrant _$ContentGrantFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ContentGrant', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['collection', 'id']);
      final val = ContentGrant(
        collection: $checkedConvert('collection', (v) => v as String),
        id: $checkedConvert('id', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$ContentGrantToJson(ContentGrant instance) =>
    <String, dynamic>{'collection': instance.collection, 'id': instance.id};
