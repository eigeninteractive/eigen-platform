// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lobby_command.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LobbyCommand _$LobbyCommandFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LobbyCommand', json, ($checkedConvert) {
      final val = LobbyCommand(
        commandId: $checkedConvert('command_id', (v) => v as String?),
      );
      return val;
    }, fieldKeyMap: const {'commandId': 'command_id'});

Map<String, dynamic> _$LobbyCommandToJson(LobbyCommand instance) =>
    <String, dynamic>{'command_id': ?instance.commandId};
