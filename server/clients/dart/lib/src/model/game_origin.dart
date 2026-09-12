//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// Where a game is played. `online` is decided entirely by the server; `local` was played on the device against on-device bots and imported afterwards.
enum GameOrigin {
  /// Where a game is played. `online` is decided entirely by the server; `local` was played on the device against on-device bots and imported afterwards.
  @JsonValue(r'online')
  online(r'online'),

  /// Where a game is played. `online` is decided entirely by the server; `local` was played on the device against on-device bots and imported afterwards.
  @JsonValue(r'local')
  local(r'local'),

  /// Where a game is played. `online` is decided entirely by the server; `local` was played on the device against on-device bots and imported afterwards.
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const GameOrigin(this.value);

  final String value;

  @override
  String toString() => value;
}
