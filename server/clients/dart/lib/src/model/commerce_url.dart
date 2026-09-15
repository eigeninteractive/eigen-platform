//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'commerce_url.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CommerceUrl {
  /// Returns a new [CommerceUrl] instance.
  CommerceUrl({required this.url});

  @JsonKey(name: r'url', required: true, includeIfNull: false)
  final String url;

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is CommerceUrl && other.url == url;

  @override
  int get hashCode => url.hashCode;

  factory CommerceUrl.fromJson(Map<String, dynamic> json) =>
      _$CommerceUrlFromJson(json);

  Map<String, dynamic> toJson() => _$CommerceUrlToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
