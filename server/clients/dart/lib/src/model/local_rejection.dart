//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/error_code.dart';
import 'package:json_annotation/json_annotation.dart';

part 'local_rejection.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LocalRejection {
  /// Returns a new [LocalRejection] instance.
  LocalRejection({
    required this.index,

    required this.code,

    required this.message,
  });

  @JsonKey(name: r'index', required: true, includeIfNull: false)
  final int index;

  @JsonKey(
    name: r'code',
    required: true,
    includeIfNull: false,
    unknownEnumValue: ErrorCode.unknownDefaultOpenApi,
  )
  final ErrorCode code;

  @JsonKey(name: r'message', required: true, includeIfNull: false)
  final String message;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is LocalRejection &&
          other.index == index &&
          other.code == code &&
          other.message == message;

  @override
  int get hashCode => index.hashCode + code.hashCode + message.hashCode;

  factory LocalRejection.fromJson(Map<String, dynamic> json) =>
      _$LocalRejectionFromJson(json);

  Map<String, dynamic> toJson() => _$LocalRejectionToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
