//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'join_by_code.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class JoinByCode {
  /// Returns a new [JoinByCode] instance.
  JoinByCode({required this.clientSchemaVersions, required this.shortCode});

  @JsonKey(name: r'clientSchemaVersions', required: true, includeIfNull: false)
  final List<int> clientSchemaVersions;

  @JsonKey(name: r'shortCode', required: true, includeIfNull: false)
  final String shortCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is JoinByCode &&
          other.clientSchemaVersions == clientSchemaVersions &&
          other.shortCode == shortCode;

  @override
  int get hashCode => clientSchemaVersions.hashCode + shortCode.hashCode;

  factory JoinByCode.fromJson(Map<String, dynamic> json) =>
      _$JoinByCodeFromJson(json);

  Map<String, dynamic> toJson() => _$JoinByCodeToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
