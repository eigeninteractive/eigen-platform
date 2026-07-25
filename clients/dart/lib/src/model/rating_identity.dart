//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'rating_identity.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RatingIdentity {
  /// Returns a new [RatingIdentity] instance.
  RatingIdentity({required this.userId, required this.botId});

  @JsonKey(name: r'userId', required: true, includeIfNull: true)
  final String? userId;

  @JsonKey(name: r'botId', required: true, includeIfNull: true)
  final String? botId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RatingIdentity && other.userId == userId && other.botId == botId;

  @override
  int get hashCode =>
      (userId == null ? 0 : userId.hashCode) +
      (botId == null ? 0 : botId.hashCode);

  factory RatingIdentity.fromJson(Map<String, dynamic> json) =>
      _$RatingIdentityFromJson(json);

  Map<String, dynamic> toJson() => _$RatingIdentityToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
