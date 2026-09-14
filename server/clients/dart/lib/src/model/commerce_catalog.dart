//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/commerce_offer.dart';
import 'package:json_annotation/json_annotation.dart';

part 'commerce_catalog.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CommerceCatalog {
  /// Returns a new [CommerceCatalog] instance.
  CommerceCatalog({required this.offers});

  @JsonKey(name: r'offers', required: true, includeIfNull: false)
  final List<CommerceOffer> offers;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CommerceCatalog && other.offers == offers;

  @override
  int get hashCode => offers.hashCode;

  factory CommerceCatalog.fromJson(Map<String, dynamic> json) =>
      _$CommerceCatalogFromJson(json);

  Map<String, dynamic> toJson() => _$CommerceCatalogToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
