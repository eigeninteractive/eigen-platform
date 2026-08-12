//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/game_summary.dart';
import 'package:json_annotation/json_annotation.dart';

part 'lobby.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Lobby {
  /// Returns a new [Lobby] instance.
  Lobby({required this.games, required this.nextCursor});

  @JsonKey(name: r'games', required: true, includeIfNull: false)
  final List<GameSummary> games;

  /// Pass as `cursor` to fetch the next page. Null when there are no more results.
  @JsonKey(name: r'nextCursor', required: true, includeIfNull: true)
  final String? nextCursor;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Lobby && other.games == games && other.nextCursor == nextCursor;

  @override
  int get hashCode =>
      games.hashCode + (nextCursor == null ? 0 : nextCursor.hashCode);

  factory Lobby.fromJson(Map<String, dynamic> json) => _$LobbyFromJson(json);

  Map<String, dynamic> toJson() => _$LobbyToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
