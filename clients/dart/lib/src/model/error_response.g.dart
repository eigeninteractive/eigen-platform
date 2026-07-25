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
  ErrorCode.notActive: 'notActive',
  ErrorCode.notReady: 'notReady',
  ErrorCode.expired: 'expired',
  ErrorCode.notPending: 'notPending',
  ErrorCode.stateUpdated: 'stateUpdated',
  ErrorCode.invalidPayload: 'invalidPayload',
  ErrorCode.illegalMove: 'illegalMove',
  ErrorCode.unknownGame: 'unknownGame',
  ErrorCode.notJoinable: 'notJoinable',
  ErrorCode.gameFull: 'gameFull',
  ErrorCode.alreadyJoined: 'alreadyJoined',
  ErrorCode.notParticipant: 'notParticipant',
  ErrorCode.notCreator: 'notCreator',
  ErrorCode.creatorCannotLeave: 'creatorCannotLeave',
  ErrorCode.schemaUnsupported: 'schemaUnsupported',
  ErrorCode.usernameInvalid: 'usernameInvalid',
  ErrorCode.usernameTaken: 'usernameTaken',
  ErrorCode.friendsOnly: 'friendsOnly',
  ErrorCode.registrationRequired: 'registrationRequired',
  ErrorCode.imageTooLarge: 'imageTooLarge',
  ErrorCode.unsupportedImageType: 'unsupportedImageType',
  ErrorCode.rateLimited: 'rateLimited',
};
