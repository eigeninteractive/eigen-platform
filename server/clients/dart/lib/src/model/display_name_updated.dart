//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'display_name_updated.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DisplayNameUpdated {
  /// Returns a new [DisplayNameUpdated] instance.
  DisplayNameUpdated({required this.displayName});

  @JsonKey(name: r'displayName', required: true, includeIfNull: false)
  final String displayName;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is DisplayNameUpdated && other.displayName == displayName;

  @override
  int get hashCode => displayName.hashCode;

  factory DisplayNameUpdated.fromJson(Map<String, dynamic> json) =>
      _$DisplayNameUpdatedFromJson(json);

  Map<String, dynamic> toJson() => _$DisplayNameUpdatedToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
