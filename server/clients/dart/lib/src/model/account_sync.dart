//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:eigen_api/src/model/player.dart';
import 'package:eigen_api/src/model/rating.dart';
import 'package:eigen_api/src/model/profile.dart';
import 'package:eigen_api/src/model/game_summary.dart';
import 'package:eigen_api/src/model/friend.dart';
import 'package:eigen_api/src/model/friend_request.dart';
import 'package:json_annotation/json_annotation.dart';

part 'account_sync.g.dart';

@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AccountSync {
  /// Returns a new [AccountSync] instance.
  AccountSync({
    required this.account,

    required this.ratings,

    required this.friends,

    required this.friendRequests,

    required this.activeGames,

    required this.finishedGames,

    required this.players,

    required this.finishedCursor,

    required this.hasMoreFinished,

    required this.historyFloor,
  });

  @JsonKey(name: r'account', required: true, includeIfNull: false)
  final Profile account;

  /// Every pool the caller is rated in. Whole.
  @JsonKey(name: r'ratings', required: true, includeIfNull: false)
  final List<Rating> ratings;

  /// Accepted friends. Whole: an absent friend was removed.
  @JsonKey(name: r'friends', required: true, includeIfNull: false)
  final List<Friend> friends;

  /// Pending requests in both directions. Whole.
  @JsonKey(name: r'friendRequests', required: true, includeIfNull: false)
  final List<FriendRequest> friendRequests;

  /// Every game the caller is seated in that has not ended. Whole: a game absent here has ended or the caller left it.
  @JsonKey(name: r'activeGames', required: true, includeIfNull: false)
  final List<GameSummary> activeGames;

  /// With `finishedAfter`: the caller's games whose finish committed after that cursor, in commit order. Without it: the newest page of the caller's history, newest first.
  @JsonKey(name: r'finishedGames', required: true, includeIfNull: false)
  final List<GameSummary> finishedGames;

  /// The identity of every human seated in the games above.
  @JsonKey(name: r'players', required: true, includeIfNull: false)
  final List<Player> players;

  /// Pass as `finishedAfter` on the next sync.
  @JsonKey(name: r'finishedCursor', required: true, includeIfNull: false)
  final int finishedCursor;

  /// More of the increment remains; sync again with `finishedCursor` straight away.
  @JsonKey(name: r'hasMoreFinished', required: true, includeIfNull: false)
  final bool hasMoreFinished;

  /// Only on a sync without `finishedAfter`: pass as `cursor` to `getMyFinishedGames` for history older than `finishedGames`. Null when that page was the whole history, and always null on an incremental sync.
  @JsonKey(name: r'historyFloor', required: true, includeIfNull: true)
  final String? historyFloor;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AccountSync &&
          other.account == account &&
          other.ratings == ratings &&
          other.friends == friends &&
          other.friendRequests == friendRequests &&
          other.activeGames == activeGames &&
          other.finishedGames == finishedGames &&
          other.players == players &&
          other.finishedCursor == finishedCursor &&
          other.hasMoreFinished == hasMoreFinished &&
          other.historyFloor == historyFloor;

  @override
  int get hashCode =>
      account.hashCode +
      ratings.hashCode +
      friends.hashCode +
      friendRequests.hashCode +
      activeGames.hashCode +
      finishedGames.hashCode +
      players.hashCode +
      finishedCursor.hashCode +
      hasMoreFinished.hashCode +
      (historyFloor == null ? 0 : historyFloor.hashCode);

  factory AccountSync.fromJson(Map<String, dynamic> json) =>
      _$AccountSyncFromJson(json);

  Map<String, dynamic> toJson() => _$AccountSyncToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}
