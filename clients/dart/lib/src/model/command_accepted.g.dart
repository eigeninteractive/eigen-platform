// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'command_accepted.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CommandAccepted _$CommandAcceptedFromJson(Map<String, dynamic> json) =>
    $checkedCreate('CommandAccepted', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['version', 'frame']);
      final val = CommandAccepted(
        version: $checkedConvert('version', (v) => (v as num).toInt()),
        frame: $checkedConvert(
          'frame',
          (v) => Frame.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$CommandAcceptedToJson(CommandAccepted instance) =>
    <String, dynamic>{
      'version': instance.version,
      'frame': instance.frame.toJson(),
    };
