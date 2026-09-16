import 'package:dio/dio.dart';
import 'package:eigen_api/eigen_api.dart';

import '../api/engine_call.dart';
import '../api/games_page.dart';

/// Number of games fetched per page of history older than a device holds.
const historyPageSize = 50;

/// The signed-in account: its sync, its profile, and its lifecycle.
///
/// Everything here is scoped to the caller by their token, so no user id is
/// passed: `/me` is always "whoever this request is authenticated as". Reading
/// *another* player's public identity is [PlayerRepository]'s job.
class AccountRepository {
  AccountRepository(Dio http) : _api = MeApi(http);

  final MeApi _api;

  /// Everything a device keeps about the account, in one read (decision 0013).
  ///
  /// Pass the previous response's [AccountSync.finishedCursor] as
  /// [finishedAfter] for the finished games since; omit it on a device that
  /// holds nothing, for the newest page of history and a
  /// [AccountSync.historyFloor] to page older history from.
  Future<AccountSync> sync({int? finishedAfter}) =>
      engineData(() => _api.syncAccount(finishedAfter: finishedAfter));

  /// The account's finished games older than [cursor], newest first: history
  /// past what the device holds. [cursor] is a history floor or a previous
  /// page's [GamesPage.nextCursor].
  Future<GamesPage> finishedGames({
    required String cursor,
    int limit = historyPageSize,
  }) async {
    final body = await engineData(
      () => _api.getMyFinishedGames(limit: limit, cursor: cursor),
    );
    return (games: body.games.toList(), nextCursor: body.nextCursor);
  }

  /// The caller's own profile, including the private fields (email) that the
  /// public [Player] projection omits.
  Future<Profile> getProfile() => engineData(() => _api.getProfile());

  /// Changes the caller's username: the unique, charset-constrained handle.
  ///
  /// Answers with the whole updated profile. Throws an [EngineException] with
  /// [ErrorCode.usernameTaken] or [ErrorCode.usernameInvalid]; both are
  /// field-level form errors rather than failures to report generically.
  Future<Profile> updateUsername(String username) => engineData(
    () =>
        _api.updateUsername(usernameUpdate: UsernameUpdate(username: username)),
  );

  /// Changes the caller's display name: the free-form label shown beside their
  /// moves. Not unique: two players may share one, which is what the username
  /// disambiguates. Answers with the whole updated profile.
  Future<Profile> updateDisplayName(String displayName) => engineData(
    () => _api.updateDisplayName(
      displayNameUpdate: DisplayNameUpdate(displayName: displayName),
    ),
  );

  /// Deletes the caller's account and all of its data.
  ///
  /// Irreversible. The server forfeits or cancels their live games, deletes the
  /// identity provider account, then purges the database, in that order, so a
  /// failure leaves the account intact and the call retriable.
  Future<void> deleteAccount() => engineCall(() => _api.deleteAccount());
}
