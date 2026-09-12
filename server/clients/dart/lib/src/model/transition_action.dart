//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'transition_action.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TransitionAction {
  /// Returns a new [TransitionAction] instance.
  TransitionAction({
    required this.type,

    required this.kind,

    required this.data,

    required this.playerIndex,
  });

  @JsonKey(
    name: r'type',
    required: true,
    includeIfNull: false,
    unknownEnumValue: TransitionActionTypeEnum.unknownDefaultOpenApi,
  )
  final TransitionActionTypeEnum type;

  @JsonKey(
    name: r'kind',
    required: true,
    includeIfNull: false,
    unknownEnumValue: TransitionActionKindEnum.unknownDefaultOpenApi,
  )
  final TransitionActionKindEnum kind;

  @JsonKey(name: r'data', required: true, includeIfNull: false)
  final Object data;

  @JsonKey(name: r'playerIndex', required: true, includeIfNull: true)
  final int? playerIndex;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TransitionAction &&
          other.type == type &&
          other.kind == kind &&
          other.data == data &&
          other.playerIndex == playerIndex;

  @override
  int get hashCode =>
      type.hashCode +
      kind.hashCode +
      data.hashCode +
      (playerIndex == null ? 0 : playerIndex.hashCode);

  factory TransitionAction.fromJson(Map<String, dynamic> json) =>
      _$TransitionActionFromJson(json);

  Map<String, dynamic> toJson() => _$TransitionActionToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum TransitionActionTypeEnum {
  @JsonValue(r'user')
  user(r'user'),
  @JsonValue(r'bot')
  bot(r'bot'),
  @JsonValue(r'system')
  system(r'system'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const TransitionActionTypeEnum(this.value);

  final String value;

  @override
  String toString() => value;
}

enum TransitionActionKindEnum {
  @JsonValue(r'game')
  game(r'game'),
  @JsonValue(r'lifecycle')
  lifecycle(r'lifecycle'),
  @JsonValue(r'ratings')
  ratings(r'ratings'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const TransitionActionKindEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
