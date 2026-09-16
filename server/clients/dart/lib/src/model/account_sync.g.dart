// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'account_sync.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AccountSync _$AccountSyncFromJson(Map<String, dynamic> json) =>
    $checkedCreate('AccountSync', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'account',
          'ratings',
          'friends',
          'friendRequests',
          'activeGames',
          'finishedGames',
          'players',
          'finishedCursor',
          'hasMoreFinished',
          'historyFloor',
        ],
      );
      final val = AccountSync(
        account: $checkedConvert(
          'account',
          (v) => Profile.fromJson(v as Map<String, dynamic>),
        ),
        ratings: $checkedConvert(
          'ratings',
          (v) => (v as List<dynamic>)
              .map((e) => Rating.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        friends: $checkedConvert(
          'friends',
          (v) => (v as List<dynamic>)
              .map((e) => Friend.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        friendRequests: $checkedConvert(
          'friendRequests',
          (v) => (v as List<dynamic>)
              .map((e) => FriendRequest.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        activeGames: $checkedConvert(
          'activeGames',
          (v) => (v as List<dynamic>)
              .map((e) => GameSummary.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        finishedGames: $checkedConvert(
          'finishedGames',
          (v) => (v as List<dynamic>)
              .map((e) => GameSummary.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        players: $checkedConvert(
          'players',
          (v) => (v as List<dynamic>)
              .map((e) => Player.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        finishedCursor: $checkedConvert(
          'finishedCursor',
          (v) => (v as num).toInt(),
        ),
        hasMoreFinished: $checkedConvert('hasMoreFinished', (v) => v as bool),
        historyFloor: $checkedConvert('historyFloor', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$AccountSyncToJson(AccountSync instance) =>
    <String, dynamic>{
      'account': instance.account.toJson(),
      'ratings': instance.ratings.map((e) => e.toJson()).toList(),
      'friends': instance.friends.map((e) => e.toJson()).toList(),
      'friendRequests': instance.friendRequests.map((e) => e.toJson()).toList(),
      'activeGames': instance.activeGames.map((e) => e.toJson()).toList(),
      'finishedGames': instance.finishedGames.map((e) => e.toJson()).toList(),
      'players': instance.players.map((e) => e.toJson()).toList(),
      'finishedCursor': instance.finishedCursor,
      'hasMoreFinished': instance.hasMoreFinished,
      'historyFloor': instance.historyFloor,
    };
