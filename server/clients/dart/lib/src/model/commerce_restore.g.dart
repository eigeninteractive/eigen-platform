// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'commerce_restore.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CommerceRestore _$CommerceRestoreFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CommerceRestore', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['claims']);
      final val = CommerceRestore(
        claims: $checkedConvert(
          'claims',
          (v) => (v as List<dynamic>)
              .map((e) => CommerceClaim.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$CommerceRestoreToJson(CommerceRestore instance) =>
    <String, dynamic>{
      'claims': instance.claims.map((e) => e.toJson()).toList(),
    };
