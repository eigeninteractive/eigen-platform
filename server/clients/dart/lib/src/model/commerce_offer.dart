//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/commerce_product.dart';
import 'package:json_annotation/json_annotation.dart';

part 'commerce_offer.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CommerceOffer {
  /// Returns a new [CommerceOffer] instance.
  CommerceOffer({
    required this.key,

    required this.name,

    required this.description,

    required this.kind,

    required this.entitlements,

    required this.products,
  });

  @JsonKey(name: r'key', required: true, includeIfNull: false)
  final String key;

  @JsonKey(name: r'name', required: true, includeIfNull: false)
  final String name;

  @JsonKey(name: r'description', required: true, includeIfNull: false)
  final String description;

  @JsonKey(
    name: r'kind',
    required: true,
    includeIfNull: false,
    unknownEnumValue: CommerceOfferKindEnum.unknownDefaultOpenApi,
  )
  final CommerceOfferKindEnum kind;

  @JsonKey(name: r'entitlements', required: true, includeIfNull: false)
  final List<String> entitlements;

  @JsonKey(name: r'products', required: true, includeIfNull: false)
  final List<CommerceProduct> products;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CommerceOffer &&
          other.key == key &&
          other.name == name &&
          other.description == description &&
          other.kind == kind &&
          other.entitlements == entitlements &&
          other.products == products;

  @override
  int get hashCode =>
      key.hashCode +
      name.hashCode +
      description.hashCode +
      kind.hashCode +
      entitlements.hashCode +
      products.hashCode;

  factory CommerceOffer.fromJson(Map<String, dynamic> json) =>
      _$CommerceOfferFromJson(json);

  Map<String, dynamic> toJson() => _$CommerceOfferToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum CommerceOfferKindEnum {
  @JsonValue(r'oneTime')
  oneTime(r'oneTime'),
  @JsonValue(r'subscription')
  subscription(r'subscription'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const CommerceOfferKindEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
