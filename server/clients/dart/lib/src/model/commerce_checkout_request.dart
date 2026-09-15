//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'commerce_checkout_request.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CommerceCheckoutRequest {
  /// Returns a new [CommerceCheckoutRequest] instance.
  CommerceCheckoutRequest({
    required this.provider,

    required this.offerKey,

    required this.returnUrl,

    required this.operationId,
  });

  @JsonKey(name: r'provider', required: true, includeIfNull: false)
  final String provider;

  @JsonKey(name: r'offerKey', required: true, includeIfNull: false)
  final String offerKey;

  @JsonKey(name: r'returnUrl', required: true, includeIfNull: false)
  final String returnUrl;

  @JsonKey(name: r'operationId', required: true, includeIfNull: false)
  final String operationId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CommerceCheckoutRequest &&
          other.provider == provider &&
          other.offerKey == offerKey &&
          other.returnUrl == returnUrl &&
          other.operationId == operationId;

  @override
  int get hashCode =>
      provider.hashCode +
      offerKey.hashCode +
      returnUrl.hashCode +
      operationId.hashCode;

  factory CommerceCheckoutRequest.fromJson(Map<String, dynamic> json) =>
      _$CommerceCheckoutRequestFromJson(json);

  Map<String, dynamic> toJson() => _$CommerceCheckoutRequestToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
