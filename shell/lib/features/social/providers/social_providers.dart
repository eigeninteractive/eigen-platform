import 'dart:async';

import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:flutter_riverpod/experimental/mutation.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'social_providers.g.dart';

@Riverpod(keepAlive: true)
SocialRepository socialRepository(Ref ref) {
  return ref.watch(engineClientProvider).social;
}

/// The caller's accepted friends, from the replica.
///
/// Every change goes to the server and is followed by a sync pass, which
/// returns the friends and requests whole: that is how a request the server
/// auto-accepted, or a friend removed from another device, reaches this list.
@riverpod
class Friends extends _$Friends {
  static final send = Mutation<void>(label: 'sendFriendRequest');
  static final accept = Mutation<void>(label: 'acceptFriendRequest');
  static final remove = Mutation<void>(label: 'removeFriend');

  @override
  Stream<List<Friend>> build() async* {
    final replica = await ref.watch(accountReplicaProvider.future);
    if (replica == null) {
      yield const [];
      return;
    }
    yield* replica.watchFriends();
  }

  /// Sends a request, or accepts one already pending from that user.
  Future<void> sendRequest(String targetUserId) async {
    final result = await ref
        .read(socialRepositoryProvider)
        .sendFriendRequest(targetUserId);
    if (result == FriendRequestResultStatusEnum.unknownDefaultOpenApi) {
      unawaited(
        ref
            .read(analyticsServiceProvider)
            .wireEnumFallback(
              enumType: 'FriendRequestResultStatus',
              surface: 'social',
            ),
      );
    }
    unawaited(ref.read(analyticsServiceProvider).friendRequestSent());
    await _resync();
  }

  Future<void> acceptRequest(String targetUserId) async {
    await ref.read(socialRepositoryProvider).acceptFriendRequest(targetUserId);
    unawaited(ref.read(analyticsServiceProvider).friendAccepted());
    await _resync();
  }

  /// Unfriends, withdraws an outgoing request, or declines an incoming one.
  Future<void> removeFriend(String targetUserId) async {
    await ref.read(socialRepositoryProvider).removeFriend(targetUserId);
    await _resync();
  }

  Future<void> _resync() => ref.read(syncCoordinatorProvider.notifier).run();
}

/// Pending requests in both directions, from the replica.
@riverpod
Stream<List<FriendRequest>> friendRequests(Ref ref) async* {
  final replica = await ref.watch(accountReplicaProvider.future);
  if (replica == null) {
    yield const [];
    return;
  }
  final analytics = ref.read(analyticsServiceProvider);
  await for (final requests in replica.watchFriendRequests()) {
    if (requests.any(
      (request) =>
          request.direction == FriendRequestDirectionEnum.unknownDefaultOpenApi,
    )) {
      unawaited(
        analytics.wireEnumFallback(
          enumType: 'FriendRequestDirection',
          surface: 'social',
        ),
      );
    }
    yield requests;
  }
}

/// Requests the caller received and can act on.
@riverpod
Future<List<FriendRequest>> incomingRequests(Ref ref) async {
  final requests = await ref.watch(friendRequestsProvider.future);
  return requests
      .where((r) => r.direction == FriendRequestDirectionEnum.incoming)
      .toList();
}

/// Requests the caller sent and can withdraw.
@riverpod
Future<List<FriendRequest>> outgoingRequests(Ref ref) async {
  final requests = await ref.watch(friendRequestsProvider.future);
  return requests
      .where((r) => r.direction == FriendRequestDirectionEnum.outgoing)
      .toList();
}

/// Joinable games created by the caller's friends.
///
/// Not replicated: a list of games joinable right now is wrong as soon as it
/// is stale, and joining needs the network anyway.
@riverpod
Future<List<GameSummary>> friendsGames(Ref ref) async {
  return (await ref.watch(socialRepositoryProvider).getFriendsGames()).games;
}

/// The current relationship between the local user and another player.
enum FriendStatus {
  friends,
  incomingPending,
  outgoingPending,
  updateRequired,
  none,
}

/// Derives the relationship with [targetId] from the friends and requests
/// lists.
///
/// Blocks are deliberately absent: a blocked user is filtered out of search and
/// cannot appear as a target here, so there is no state to render for them.
FriendStatus computeFriendStatus(
  List<Friend> friends,
  List<FriendRequest> requests,
  String targetId,
) {
  if (friends.any((f) => f.userId == targetId)) return FriendStatus.friends;
  for (final request in requests) {
    if (request.userId != targetId) continue;
    return switch (request.direction) {
      FriendRequestDirectionEnum.incoming => FriendStatus.incomingPending,
      FriendRequestDirectionEnum.outgoing => FriendStatus.outgoingPending,
      FriendRequestDirectionEnum.unknownDefaultOpenApi =>
        FriendStatus.updateRequired,
    };
  }
  return FriendStatus.none;
}

@riverpod
Future<FriendStatus> friendStatus(Ref ref, {required String targetId}) async {
  final friends = await ref.watch(friendsProvider.future);
  final requests = await ref.watch(friendRequestsProvider.future);
  return computeFriendStatus(friends, requests, targetId);
}
