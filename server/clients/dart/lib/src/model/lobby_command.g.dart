// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lobby_command.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LobbyCommand _$LobbyCommandFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LobbyCommand', json, ($checkedConvert) {
      final val = LobbyCommand(
        commandId: $checkedConvert('commandId', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$LobbyCommandToJson(LobbyCommand instance) =>
    <String, dynamic>{'commandId': ?instance.commandId};
