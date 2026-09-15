//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/access_capability.dart';
import 'package:eigen_api/src/model/active_entitlement.dart';
import 'package:eigen_api/src/model/content_grant.dart';
import 'package:eigen_api/src/model/commercial_limit_access.dart';
import 'package:json_annotation/json_annotation.dart';

part 'access_snapshot.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AccessSnapshot {
  /// Returns a new [AccessSnapshot] instance.
  AccessSnapshot({
    required this.entitlements,

    required this.permissions,

    required this.content,

    required this.limits,
  });

  @JsonKey(name: r'entitlements', required: true, includeIfNull: false)
  final List<ActiveEntitlement> entitlements;

  @JsonKey(name: r'permissions', required: true, includeIfNull: false)
  final List<AccessCapability> permissions;

  @JsonKey(name: r'content', required: true, includeIfNull: false)
  final List<ContentGrant> content;

  @JsonKey(name: r'limits', required: true, includeIfNull: false)
  final List<CommercialLimitAccess> limits;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AccessSnapshot &&
          other.entitlements == entitlements &&
          other.permissions == permissions &&
          other.content == content &&
          other.limits == limits;

  @override
  int get hashCode =>
      entitlements.hashCode +
      permissions.hashCode +
      content.hashCode +
      limits.hashCode;

  factory AccessSnapshot.fromJson(Map<String, dynamic> json) =>
      _$AccessSnapshotFromJson(json);

  Map<String, dynamic> toJson() => _$AccessSnapshotToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
