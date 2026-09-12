// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'local_rejection.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LocalRejection _$LocalRejectionFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LocalRejection', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['index', 'code', 'message']);
      final val = LocalRejection(
        index: $checkedConvert('index', (v) => (v as num).toInt()),
        code: $checkedConvert(
          'code',
          (v) => $enumDecode(
            _$ErrorCodeEnumMap,
            v,
            unknownValue: ErrorCode.unknownDefaultOpenApi,
          ),
        ),
        message: $checkedConvert('message', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$LocalRejectionToJson(LocalRejection instance) =>
    <String, dynamic>{
      'index': instance.index,
      'code': _$ErrorCodeEnumMap[instance.code]!,
      'message': instance.message,
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
  ErrorCode.clientUpdateRequired: 'clientUpdateRequired',
  ErrorCode.serverUpdateRequired: 'serverUpdateRequired',
  ErrorCode.usernameInvalid: 'usernameInvalid',
  ErrorCode.usernameTaken: 'usernameTaken',
  ErrorCode.friendsOnly: 'friendsOnly',
  ErrorCode.registrationRequired: 'registrationRequired',
  ErrorCode.imageTooLarge: 'imageTooLarge',
  ErrorCode.unsupportedImageType: 'unsupportedImageType',
  ErrorCode.rateLimited: 'rateLimited',
  ErrorCode.invalidCursor: 'invalidCursor',
  ErrorCode.localOnly: 'localOnly',
  ErrorCode.notLocalBot: 'notLocalBot',
  ErrorCode.unknownDefaultOpenApi: 'unknown_default_open_api',
};
