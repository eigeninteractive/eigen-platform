// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'access_snapshot.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AccessSnapshot _$AccessSnapshotFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('AccessSnapshot', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['entitlements', 'permissions', 'content', 'limits'],
  );
  final val = AccessSnapshot(
    entitlements: $checkedConvert(
      'entitlements',
      (v) => (v as List<dynamic>)
          .map((e) => ActiveEntitlement.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    permissions: $checkedConvert(
      'permissions',
      (v) => (v as List<dynamic>)
          .map((e) => AccessCapability.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    content: $checkedConvert(
      'content',
      (v) => (v as List<dynamic>)
          .map((e) => ContentGrant.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    limits: $checkedConvert(
      'limits',
      (v) => (v as List<dynamic>)
          .map((e) => CommercialLimitAccess.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$AccessSnapshotToJson(AccessSnapshot instance) =>
    <String, dynamic>{
      'entitlements': instance.entitlements.map((e) => e.toJson()).toList(),
      'permissions': instance.permissions.map((e) => e.toJson()).toList(),
      'content': instance.content.map((e) => e.toJson()).toList(),
      'limits': instance.limits.map((e) => e.toJson()).toList(),
    };
