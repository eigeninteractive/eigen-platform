//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'content_grant.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ContentGrant {
  /// Returns a new [ContentGrant] instance.
  ContentGrant({required this.collection, required this.id});

  @JsonKey(name: r'collection', required: true, includeIfNull: false)
  final String collection;

  @JsonKey(name: r'id', required: true, includeIfNull: false)
  final String id;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is ContentGrant && other.collection == collection && other.id == id;

  @override
  int get hashCode => collection.hashCode + id.hashCode;

  factory ContentGrant.fromJson(Map<String, dynamic> json) =>
      _$ContentGrantFromJson(json);

  Map<String, dynamic> toJson() => _$ContentGrantToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
