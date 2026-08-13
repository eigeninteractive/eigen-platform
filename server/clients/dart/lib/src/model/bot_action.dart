//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'bot_action.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BotAction {
  /// Returns a new [BotAction] instance.
  BotAction({
    required this.botId,

    required this.gameId,

    required this.playerIndex,

    required this.version,

    this.data,
  });

  @JsonKey(name: r'botId', required: true, includeIfNull: false)
  final String botId;

  @JsonKey(name: r'gameId', required: true, includeIfNull: false)
  final String gameId;

  // minimum: 0
  @JsonKey(name: r'playerIndex', required: true, includeIfNull: false)
  final int playerIndex;

  // minimum: 0
  @JsonKey(name: r'version', required: true, includeIfNull: false)
  final int version;

  @JsonKey(name: r'data', required: false, includeIfNull: false)
  final Object? data;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BotAction &&
          other.botId == botId &&
          other.gameId == gameId &&
          other.playerIndex == playerIndex &&
          other.version == version &&
          other.data == data;

  @override
  int get hashCode =>
      botId.hashCode +
      gameId.hashCode +
      playerIndex.hashCode +
      version.hashCode +
      (data == null ? 0 : data.hashCode);

  factory BotAction.fromJson(Map<String, dynamic> json) =>
      _$BotActionFromJson(json);

  Map<String, dynamic> toJson() => _$BotActionToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
