// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'command_accepted.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CommandAccepted _$CommandAcceptedFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CommandAccepted', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['session']);
      final val = CommandAccepted(
        session: $checkedConvert(
          'session',
          (v) => Session.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$CommandAcceptedToJson(CommandAccepted instance) =>
    <String, dynamic>{'session': instance.session.toJson()};
