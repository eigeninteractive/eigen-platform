//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/session.dart';
import 'package:json_annotation/json_annotation.dart';

part 'solo_started.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SoloStarted {
  /// Returns a new [SoloStarted] instance.
  SoloStarted({required this.session});

  @JsonKey(name: r'session', required: true, includeIfNull: false)
  final Session session;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SoloStarted && other.session == session;

  @override
  int get hashCode => session.hashCode;

  factory SoloStarted.fromJson(Map<String, dynamic> json) =>
      _$SoloStartedFromJson(json);

  Map<String, dynamic> toJson() => _$SoloStartedToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
