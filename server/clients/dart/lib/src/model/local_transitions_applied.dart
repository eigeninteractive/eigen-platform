//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/session.dart';
import 'package:eigen_api/src/model/local_rejection.dart';
import 'package:json_annotation/json_annotation.dart';

part 'local_transitions_applied.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LocalTransitionsApplied {
  /// Returns a new [LocalTransitionsApplied] instance.
  LocalTransitionsApplied({
    required this.applied,

    required this.session,

    required this.rejection,
  });

  @JsonKey(name: r'applied', required: true, includeIfNull: false)
  final int applied;

  @JsonKey(name: r'session', required: true, includeIfNull: false)
  final Session session;

  @JsonKey(name: r'rejection', required: true, includeIfNull: true)
  final LocalRejection? rejection;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LocalTransitionsApplied &&
          other.applied == applied &&
          other.session == session &&
          other.rejection == rejection;

  @override
  int get hashCode =>
      applied.hashCode +
      session.hashCode +
      (rejection == null ? 0 : rejection.hashCode);

  factory LocalTransitionsApplied.fromJson(Map<String, dynamic> json) =>
      _$LocalTransitionsAppliedFromJson(json);

  Map<String, dynamic> toJson() => _$LocalTransitionsAppliedToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
