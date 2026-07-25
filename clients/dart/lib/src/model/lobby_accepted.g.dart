// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'lobby_accepted.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LobbyAccepted _$LobbyAcceptedFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LobbyAccepted', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['roster']);
      final val = LobbyAccepted(
        roster: $checkedConvert(
          'roster',
          (v) => Roster.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$LobbyAcceptedToJson(LobbyAccepted instance) =>
    <String, dynamic>{'roster': instance.roster.toJson()};
