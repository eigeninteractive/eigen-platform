//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/transition_action.dart';
import 'package:json_annotation/json_annotation.dart';

part 'local_transition_row.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LocalTransitionRow {
  /// Returns a new [LocalTransitionRow] instance.
  LocalTransitionRow({
    required this.version,

    required this.state,

    required this.action,

    required this.pending,
  });

  @JsonKey(name: r'version', required: true, includeIfNull: false)
  final int version;

  @JsonKey(name: r'state', required: true, includeIfNull: false)
  final Object state;

  @JsonKey(name: r'action', required: true, includeIfNull: true)
  final TransitionAction? action;

  @JsonKey(name: r'pending', required: true, includeIfNull: false)
  final List<int> pending;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LocalTransitionRow &&
          other.version == version &&
          other.state == state &&
          other.action == action &&
          other.pending == pending;

  @override
  int get hashCode =>
      version.hashCode +
      state.hashCode +
      (action == null ? 0 : action.hashCode) +
      pending.hashCode;

  factory LocalTransitionRow.fromJson(Map<String, dynamic> json) =>
      _$LocalTransitionRowFromJson(json);

  Map<String, dynamic> toJson() => _$LocalTransitionRowToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
