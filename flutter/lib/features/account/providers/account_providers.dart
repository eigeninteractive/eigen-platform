import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/core/replica/replica_providers.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'account_providers.g.dart';

// The signed-in account, read from the replica (decision 0013). Each of these
// answers straight away from what the device holds, with no network, and
// re-emits whenever a sync pass or a mutation's answer changes a row it shows.
// Before an account's first sync they answer empty or null.

/// The signed-in account's own profile, or null before its first sync.
@riverpod
Stream<Profile?> accountProfile(Ref ref) async* {
  final replica = await ref.watch(accountReplicaProvider.future);
  if (replica == null) {
    yield null;
    return;
  }
  yield* replica.watchProfile();
}

/// The signed-in account's display ratings, best first.
@riverpod
Stream<List<Rating>> accountRatings(Ref ref) async* {
  final replica = await ref.watch(accountReplicaProvider.future);
  if (replica == null) {
    yield const [];
    return;
  }
  yield* replica.watchRatings();
}

/// The signed-in account's accepted friends.
@riverpod
Stream<List<Friend>> accountFriends(Ref ref) async* {
  final replica = await ref.watch(accountReplicaProvider.future);
  if (replica == null) {
    yield const [];
    return;
  }
  yield* replica.watchFriends();
}

/// The signed-in account's pending requests, in both directions.
@riverpod
Stream<List<FriendRequest>> accountFriendRequests(Ref ref) async* {
  final replica = await ref.watch(accountReplicaProvider.future);
  if (replica == null) {
    yield const [];
    return;
  }
  yield* replica.watchFriendRequests();
}

/// When the signed-in account last synced, and whether older history remains
/// on the server.
@riverpod
Stream<HistoryState> accountHistory(Ref ref) async* {
  final replica = await ref.watch(accountReplicaProvider.future);
  if (replica == null) {
    yield (lastSyncedAt: null, hasOlder: false);
    return;
  }
  yield* replica.watchHistory();
}
