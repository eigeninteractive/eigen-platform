import 'package:dio/dio.dart';
import 'package:eigen_api/eigen_api.dart';

import '../api/engine_call.dart';

/// Another player's ratings.
///
/// Ratings are computed server-side inside the finish transaction and delivered
/// to a live game as a post-finish transition. The caller's own ratings, and
/// every change to them, arrive with the account sync instead.
class RatingRepository {
  RatingRepository(Dio http) : _players = PlayersApi(http);

  final PlayersApi _players;

  /// Every pool [playerId] has played in, best rating first.
  ///
  /// Works for humans and bots alike: a rating row is keyed by exactly one of
  /// the two, so the id alone is enough. Display ratings are public.
  Future<List<Rating>> getPlayerRatings(String playerId) async {
    final body = await engineData(
      () => _players.getPlayerRatings(playerId: playerId),
    );
    return body.ratings;
  }
}
