//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/session.dart';
import 'package:json_annotation/json_annotation.dart';

part 'command_accepted.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CommandAccepted {
  /// Returns a new [CommandAccepted] instance.
  CommandAccepted({required this.session});

  @JsonKey(name: r'session', required: true, includeIfNull: false)
  final Session session;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CommandAccepted && other.session == session;

  @override
  int get hashCode => session.hashCode;

  factory CommandAccepted.fromJson(Map<String, dynamic> json) =>
      _$CommandAcceptedFromJson(json);

  Map<String, dynamic> toJson() => _$CommandAcceptedToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
