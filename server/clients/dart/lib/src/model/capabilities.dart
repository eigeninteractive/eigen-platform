//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'capabilities.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Capabilities {
  /// Returns a new [Capabilities] instance.
  Capabilities({
    required this.creatableSchemaVersions,

    required this.supportedSchemaVersions,
  });

  @JsonKey(
    name: r'creatableSchemaVersions',
    required: true,
    includeIfNull: false,
  )
  final List<int> creatableSchemaVersions;

  @JsonKey(
    name: r'supportedSchemaVersions',
    required: true,
    includeIfNull: false,
  )
  final List<int> supportedSchemaVersions;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Capabilities &&
          other.creatableSchemaVersions == creatableSchemaVersions &&
          other.supportedSchemaVersions == supportedSchemaVersions;

  @override
  int get hashCode =>
      creatableSchemaVersions.hashCode + supportedSchemaVersions.hashCode;

  factory Capabilities.fromJson(Map<String, dynamic> json) =>
      _$CapabilitiesFromJson(json);

  Map<String, dynamic> toJson() => _$CapabilitiesToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
