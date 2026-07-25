// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'error_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ErrorResponse _$ErrorResponseFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ErrorResponse', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['error']);
      final val = ErrorResponse(
        error: $checkedConvert('error', (v) => v as String),
        code: $checkedConvert(
          'code',
          (v) => $enumDecodeNullable(_$ErrorCodeEnumMap, v),
        ),
      );
      return val;
    });

Map<String, dynamic> _$ErrorResponseToJson(ErrorResponse instance) =>
    <String, dynamic>{
      'error': instance.error,
      'code': ?_$ErrorCodeEnumMap[instance.code],
    };

const _$ErrorCodeEnumMap = {
  ErrorCode.notActive: 'not_active',
  ErrorCode.notReady: 'not_ready',
  ErrorCode.expired: 'expired',
  ErrorCode.notPending: 'not_pending',
  ErrorCode.stateUpdated: 'state_updated',
  ErrorCode.invalidPayload: 'invalid_payload',
  ErrorCode.illegalMove: 'illegal_move',
  ErrorCode.unknownGame: 'unknown_game',
  ErrorCode.notJoinable: 'not_joinable',
  ErrorCode.gameFull: 'game_full',
  ErrorCode.alreadyJoined: 'already_joined',
  ErrorCode.notParticipant: 'not_participant',
  ErrorCode.notCreator: 'not_creator',
  ErrorCode.creatorCannotLeave: 'creator_cannot_leave',
  ErrorCode.schemaUnsupported: 'schema_unsupported',
  ErrorCode.usernameInvalid: 'username_invalid',
  ErrorCode.usernameTaken: 'username_taken',
  ErrorCode.friendsOnly: 'friends_only',
  ErrorCode.registrationRequired: 'registration_required',
  ErrorCode.imageTooLarge: 'image_too_large',
  ErrorCode.unsupportedImageType: 'unsupported_image_type',
  ErrorCode.rateLimited: 'rate_limited',
};
