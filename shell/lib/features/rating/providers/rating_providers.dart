import 'dart:async';

import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'rating_providers.g.dart';

@Riverpod(keepAlive: true)
RatingRepository ratingRepository(Ref ref) =>
    ref.watch(engineClientProvider).ratings;

/// All pool ratings for `id`, best first: humans and bots alike.
///
/// Shown from the replica straight away, and refreshed from the server each
/// time something starts watching, so another player's sheet opens instantly
/// and offline, and is current when it can be.
@riverpod
Stream<List<Rating>> playerRatings(Ref ref, String id) async* {
  final public = await ref.watch(publicReplicaProvider.future);
  final repository = ref.read(ratingRepositoryProvider);
  unawaited(
    repository
        .getPlayerRatings(id)
        .then((ratings) => public.applyRatings(id, ratings))
        .catchError((Object _) {}),
  );
  yield* public.watchRatings(id);
}
