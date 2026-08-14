//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'forfeit.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Forfeit {
  /// Returns a new [Forfeit] instance.
  Forfeit({required this.seat});

  // minimum: 0
  @JsonKey(name: r'seat', required: true, includeIfNull: false)
  final int seat;

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is Forfeit && other.seat == seat;

  @override
  int get hashCode => seat.hashCode;

  factory Forfeit.fromJson(Map<String, dynamic> json) =>
      _$ForfeitFromJson(json);

  Map<String, dynamic> toJson() => _$ForfeitToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
