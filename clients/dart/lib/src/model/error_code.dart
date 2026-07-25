//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:json_annotation/json_annotation.dart';

/// A stable machine code identifying why a request failed.
enum ErrorCode {
  /// A stable machine code identifying why a request failed.
  @JsonValue(r'notActive')
  notActive(r'notActive'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'notReady')
  notReady(r'notReady'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'expired')
  expired(r'expired'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'notPending')
  notPending(r'notPending'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'stateUpdated')
  stateUpdated(r'stateUpdated'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'invalidPayload')
  invalidPayload(r'invalidPayload'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'illegalMove')
  illegalMove(r'illegalMove'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'unknownGame')
  unknownGame(r'unknownGame'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'notJoinable')
  notJoinable(r'notJoinable'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'gameFull')
  gameFull(r'gameFull'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'alreadyJoined')
  alreadyJoined(r'alreadyJoined'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'notParticipant')
  notParticipant(r'notParticipant'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'notCreator')
  notCreator(r'notCreator'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'creatorCannotLeave')
  creatorCannotLeave(r'creatorCannotLeave'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'schemaUnsupported')
  schemaUnsupported(r'schemaUnsupported'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'usernameInvalid')
  usernameInvalid(r'usernameInvalid'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'usernameTaken')
  usernameTaken(r'usernameTaken'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'friendsOnly')
  friendsOnly(r'friendsOnly'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'registrationRequired')
  registrationRequired(r'registrationRequired'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'imageTooLarge')
  imageTooLarge(r'imageTooLarge'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'unsupportedImageType')
  unsupportedImageType(r'unsupportedImageType'),

  /// A stable machine code identifying why a request failed.
  @JsonValue(r'rateLimited')
  rateLimited(r'rateLimited');

  const ErrorCode(this.value);

  final String value;

  @override
  String toString() => value;
}
