//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'commerce_management_request.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CommerceManagementRequest {
  /// Returns a new [CommerceManagementRequest] instance.
  CommerceManagementRequest({required this.provider, required this.returnUrl});

  @JsonKey(name: r'provider', required: true, includeIfNull: false)
  final String provider;

  @JsonKey(name: r'returnUrl', required: true, includeIfNull: false)
  final String returnUrl;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CommerceManagementRequest &&
          other.provider == provider &&
          other.returnUrl == returnUrl;

  @override
  int get hashCode => provider.hashCode + returnUrl.hashCode;

  factory CommerceManagementRequest.fromJson(Map<String, dynamic> json) =>
      _$CommerceManagementRequestFromJson(json);

  Map<String, dynamic> toJson() => _$CommerceManagementRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
