import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';

part 'rating_providers.g.dart';

@Riverpod(keepAlive: true)
RatingRepository ratingRepository(Ref ref) =>
    ref.watch(engineClientProvider).ratings;

/// All pool ratings for [id], ordered by highest display rating.
///
/// Works for both human user IDs and bot IDs.
@riverpod
Future<List<Rating>> playerRatings(Ref ref, String id) =>
    ref.watch(ratingRepositoryProvider).getPlayerRatings(id);

/// Current user's ratings across all pools.
///
/// Auto-disposes when the profile screen is not visible, so navigation
/// to the profile page always fetches fresh data.
@riverpod
Future<List<Rating>> myRatings(Ref ref) {
  // Null during the brief sign-out window before navigation completes,
  // return empty rather than crashing the disposing profile screen.
  final userId = ref.watch(currentUserIdProvider);
  if (userId == null) return Future.value(const []);
  return ref.watch(ratingRepositoryProvider).getMyRatings();
}
