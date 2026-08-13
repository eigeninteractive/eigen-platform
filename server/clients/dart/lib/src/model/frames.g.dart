// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'frames.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Frames _$FramesFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Frames', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['frames']);
      final val = Frames(
        frames: $checkedConvert(
          'frames',
          (v) => (v as List<dynamic>)
              .map((e) => Frame.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$FramesToJson(Frames instance) => <String, dynamic>{
  'frames': instance.frames.map((e) => e.toJson()).toList(),
};
