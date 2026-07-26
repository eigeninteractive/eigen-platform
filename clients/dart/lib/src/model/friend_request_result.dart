//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

part 'friend_request_result.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class FriendRequestResult {
  /// Returns a new [FriendRequestResult] instance.
  FriendRequestResult({required this.status});

  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: FriendRequestResultStatusEnum.unknownDefaultOpenApi,
  )
  final FriendRequestResultStatusEnum status;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is FriendRequestResult && other.status == status;

  @override
  int get hashCode => status.hashCode;

  factory FriendRequestResult.fromJson(Map<String, dynamic> json) =>
      _$FriendRequestResultFromJson(json);

  Map<String, dynamic> toJson() => _$FriendRequestResultToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

enum FriendRequestResultStatusEnum {
  @JsonValue(r'requested')
  requested(r'requested'),
  @JsonValue(r'accepted')
  accepted(r'accepted'),
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const FriendRequestResultStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
