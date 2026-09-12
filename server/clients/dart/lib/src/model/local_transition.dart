//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'local_transition.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LocalTransition {
  /// Returns a new [LocalTransition] instance.
  LocalTransition({required this.seat, required this.kind, this.data});

  // minimum: 0
  @JsonKey(name: r'seat', required: true, includeIfNull: false)
  final int seat;

  @JsonKey(
    name: r'kind',
    required: true,
    includeIfNull: false,
    unknownEnumValue: LocalTransitionKindEnum.unknownDefaultOpenApi,
  )
  final LocalTransitionKindEnum kind;

  @JsonKey(name: r'data', required: false, includeIfNull: false)
  final Object? data;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LocalTransition &&
          other.seat == seat &&
          other.kind == kind &&
          other.data == data;

  @override
  int get hashCode =>
      seat.hashCode + kind.hashCode + (data == null ? 0 : data.hashCode);

  factory LocalTransition.fromJson(Map<String, dynamic> json) =>
      _$LocalTransitionFromJson(json);

  Map<String, dynamic> toJson() => _$LocalTransitionToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum LocalTransitionKindEnum {
  @JsonValue(r'game')
  game(r'game'),
  @JsonValue(r'lifecycle')
  lifecycle(r'lifecycle'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const LocalTransitionKindEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
