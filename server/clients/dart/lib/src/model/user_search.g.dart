// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'user_search.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

UserSearch _$UserSearchFromJson(Map<String, dynamic> json) =>
    $checkedCreate('UserSearch', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['users']);
      final val = UserSearch(
        users: $checkedConvert(
          'users',
          (v) => (v as List<dynamic>)
              .map((e) => Player.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$UserSearchToJson(UserSearch instance) =>
    <String, dynamic>{'users': instance.users.map((e) => e.toJson()).toList()};
