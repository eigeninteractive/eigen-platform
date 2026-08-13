//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/rating_history_entry.dart';
import 'package:json_annotation/json_annotation.dart';

part 'rating_history.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RatingHistory {
  /// Returns a new [RatingHistory] instance.
  RatingHistory({required this.history});

  @JsonKey(name: r'history', required: true, includeIfNull: false)
  final List<RatingHistoryEntry> history;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RatingHistory && other.history == history;

  @override
  int get hashCode => history.hashCode;

  factory RatingHistory.fromJson(Map<String, dynamic> json) =>
      _$RatingHistoryFromJson(json);

  Map<String, dynamic> toJson() => _$RatingHistoryToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
