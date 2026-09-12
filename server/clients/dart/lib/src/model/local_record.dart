//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/session.dart';
import 'package:eigen_api/src/model/local_transition_row.dart';
import 'package:json_annotation/json_annotation.dart';

part 'local_record.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LocalRecord {
  /// Returns a new [LocalRecord] instance.
  LocalRecord({
    required this.session,

    required this.seed,

    required this.createdAt,

    required this.finishedAt,

    required this.transitions,
  });

  @JsonKey(name: r'session', required: true, includeIfNull: false)
  final Session session;

  @JsonKey(name: r'seed', required: true, includeIfNull: false)
  final String seed;

  @JsonKey(name: r'createdAt', required: true, includeIfNull: false)
  final int createdAt;

  @JsonKey(name: r'finishedAt', required: true, includeIfNull: true)
  final int? finishedAt;

  @JsonKey(name: r'transitions', required: true, includeIfNull: false)
  final List<LocalTransitionRow> transitions;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LocalRecord &&
          other.session == session &&
          other.seed == seed &&
          other.createdAt == createdAt &&
          other.finishedAt == finishedAt &&
          other.transitions == transitions;

  @override
  int get hashCode =>
      session.hashCode +
      seed.hashCode +
      createdAt.hashCode +
      (finishedAt == null ? 0 : finishedAt.hashCode) +
      transitions.hashCode;

  factory LocalRecord.fromJson(Map<String, dynamic> json) =>
      _$LocalRecordFromJson(json);

  Map<String, dynamic> toJson() => _$LocalRecordToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
