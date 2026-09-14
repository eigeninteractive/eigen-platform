//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'commerce_product.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CommerceProduct {
  /// Returns a new [CommerceProduct] instance.
  CommerceProduct({
    required this.provider,

    required this.productId,

    required this.displayPrice,

    required this.currencyCode,
  });

  @JsonKey(name: r'provider', required: true, includeIfNull: false)
  final String provider;

  @JsonKey(name: r'productId', required: true, includeIfNull: false)
  final String productId;

  @JsonKey(name: r'displayPrice', required: true, includeIfNull: true)
  final String? displayPrice;

  @JsonKey(name: r'currencyCode', required: true, includeIfNull: true)
  final String? currencyCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CommerceProduct &&
          other.provider == provider &&
          other.productId == productId &&
          other.displayPrice == displayPrice &&
          other.currencyCode == currencyCode;

  @override
  int get hashCode =>
      provider.hashCode +
      productId.hashCode +
      (displayPrice == null ? 0 : displayPrice.hashCode) +
      (currencyCode == null ? 0 : currencyCode.hashCode);

  factory CommerceProduct.fromJson(Map<String, dynamic> json) =>
      _$CommerceProductFromJson(json);

  Map<String, dynamic> toJson() => _$CommerceProductToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
