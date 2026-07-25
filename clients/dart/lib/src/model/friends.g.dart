// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'friends.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Friends _$FriendsFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Friends', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['friends']);
      final val = Friends(
        friends: $checkedConvert(
          'friends',
          (v) => (v as List<dynamic>)
              .map((e) => Friend.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$FriendsToJson(Friends instance) => <String, dynamic>{
  'friends': instance.friends.map((e) => e.toJson()).toList(),
};
