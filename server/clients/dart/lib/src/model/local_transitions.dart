//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/local_transition.dart';
import 'package:json_annotation/json_annotation.dart';

part 'local_transitions.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LocalTransitions {
  /// Returns a new [LocalTransitions] instance.
  LocalTransitions({required this.fromVersion, required this.transitions});

  // minimum: 0
  @JsonKey(name: r'fromVersion', required: true, includeIfNull: false)
  final int fromVersion;

  @JsonKey(name: r'transitions', required: true, includeIfNull: false)
  final List<LocalTransition> transitions;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LocalTransitions &&
          other.fromVersion == fromVersion &&
          other.transitions == transitions;

  @override
  int get hashCode => fromVersion.hashCode + transitions.hashCode;

  factory LocalTransitions.fromJson(Map<String, dynamic> json) =>
      _$LocalTransitionsFromJson(json);

  Map<String, dynamic> toJson() => _$LocalTransitionsToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
