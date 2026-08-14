//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'join.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Join {
  /// Returns a new [Join] instance.
  Join({required this.clientSchemaVersions});

  @JsonKey(name: r'clientSchemaVersions', required: true, includeIfNull: false)
  final List<int> clientSchemaVersions;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Join && other.clientSchemaVersions == clientSchemaVersions;

  @override
  int get hashCode => clientSchemaVersions.hashCode;

  factory Join.fromJson(Map<String, dynamic> json) => _$JoinFromJson(json);

  Map<String, dynamic> toJson() => _$JoinToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
