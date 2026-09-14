//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'active_entitlement.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ActiveEntitlement {
  /// Returns a new [ActiveEntitlement] instance.
  ActiveEntitlement({
    required this.key,

    required this.validFrom,

    required this.validUntil,
  });

  @JsonKey(name: r'key', required: true, includeIfNull: false)
  final String key;

  @JsonKey(name: r'validFrom', required: true, includeIfNull: false)
  final int validFrom;

  @JsonKey(name: r'validUntil', required: true, includeIfNull: true)
  final int? validUntil;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ActiveEntitlement &&
          other.key == key &&
          other.validFrom == validFrom &&
          other.validUntil == validUntil;

  @override
  int get hashCode =>
      key.hashCode +
      validFrom.hashCode +
      (validUntil == null ? 0 : validUntil.hashCode);

  factory ActiveEntitlement.fromJson(Map<String, dynamic> json) =>
      _$ActiveEntitlementFromJson(json);

  Map<String, dynamic> toJson() => _$ActiveEntitlementToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
