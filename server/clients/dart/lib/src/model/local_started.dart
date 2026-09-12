//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/session.dart';
import 'package:json_annotation/json_annotation.dart';

part 'local_started.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LocalStarted {
  /// Returns a new [LocalStarted] instance.
  LocalStarted({required this.session});

  @JsonKey(name: r'session', required: true, includeIfNull: false)
  final Session session;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LocalStarted && other.session == session;

  @override
  int get hashCode => session.hashCode;

  factory LocalStarted.fromJson(Map<String, dynamic> json) =>
      _$LocalStartedFromJson(json);

  Map<String, dynamic> toJson() => _$LocalStartedToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
