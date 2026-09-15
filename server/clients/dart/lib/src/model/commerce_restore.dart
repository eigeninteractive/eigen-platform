//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/commerce_claim.dart';
import 'package:json_annotation/json_annotation.dart';

part 'commerce_restore.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CommerceRestore {
  /// Returns a new [CommerceRestore] instance.
  CommerceRestore({required this.claims});

  @JsonKey(name: r'claims', required: true, includeIfNull: false)
  final List<CommerceClaim> claims;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CommerceRestore && other.claims == claims;

  @override
  int get hashCode => claims.hashCode;

  factory CommerceRestore.fromJson(Map<String, dynamic> json) =>
      _$CommerceRestoreFromJson(json);

  Map<String, dynamic> toJson() => _$CommerceRestoreToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
