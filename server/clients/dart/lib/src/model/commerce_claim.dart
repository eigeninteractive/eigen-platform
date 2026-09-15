//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'commerce_claim.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CommerceClaim {
  /// Returns a new [CommerceClaim] instance.
  CommerceClaim({
    required this.provider,

    required this.offerKey,

    required this.evidence,
  });

  @JsonKey(name: r'provider', required: true, includeIfNull: false)
  final String provider;

  @JsonKey(name: r'offerKey', required: true, includeIfNull: false)
  final String offerKey;

  @JsonKey(name: r'evidence', required: true, includeIfNull: false)
  final Map<String, Object> evidence;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CommerceClaim &&
          other.provider == provider &&
          other.offerKey == offerKey &&
          other.evidence == evidence;

  @override
  int get hashCode => provider.hashCode + offerKey.hashCode + evidence.hashCode;

  factory CommerceClaim.fromJson(Map<String, dynamic> json) =>
      _$CommerceClaimFromJson(json);

  Map<String, dynamic> toJson() => _$CommerceClaimToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
