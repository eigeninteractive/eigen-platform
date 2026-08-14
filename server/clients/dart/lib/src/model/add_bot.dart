//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'add_bot.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AddBot {
  /// Returns a new [AddBot] instance.
  AddBot({required this.botId});

  @JsonKey(name: r'botId', required: true, includeIfNull: false)
  final String botId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is AddBot && other.botId == botId;

  @override
  int get hashCode => botId.hashCode;

  factory AddBot.fromJson(Map<String, dynamic> json) => _$AddBotFromJson(json);

  Map<String, dynamic> toJson() => _$AddBotToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
