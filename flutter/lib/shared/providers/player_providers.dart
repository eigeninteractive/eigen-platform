import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/core/api/engine_api_providers.dart';
import 'package:eigen_flutter/core/replica/replica_providers.dart';
import 'package:eigen_flutter/features/game/providers/game_providers.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'player_providers.g.dart';

/// Singleton [PlayerRepository] instance.
@Riverpod(keepAlive: true)
PlayerRepository playerRepository(Ref ref) {
  return ref.watch(engineClientProvider).players;
}

/// Coalesces identity lookups into one batch request.
///
/// A session-lived singleton so its batching window spans the whole app: every
/// id a single widget build finds missing from the replica funnels through one
/// [PlayerBatchLoader] and one network call.
@Riverpod(keepAlive: true)
PlayerBatchLoader playerBatchLoader(Ref ref) {
  final loader = PlayerBatchLoader(
    ref.watch(playerRepositoryProvider).getPlayers,
  );
  ref.onDispose(loader.dispose);
  return loader;
}

/// One human's public identity, from the replica.
///
/// The sync pass stores the identity of everyone seated in the account's games
/// and of its friends, so this is almost always a read. An id the replica does
/// not hold yet (a lobby seat, a player found by search) is fetched once and
/// stored. An id the server no longer knows is a deleted account: it is dropped
/// from the replica and this answers null, which a seat renders as deleted
/// (decision 0007). Offline, a missing identity simply stays null until a lookup
/// can succeed.
@riverpod
Stream<Player?> playerIdentity(Ref ref, {required String id}) async* {
  final public = await ref.watch(publicReplicaProvider.future);
  if ((await public.missingPlayers([id])).isNotEmpty) {
    try {
      await public.applyPlayers([
        await ref.read(playerBatchLoaderProvider).load(id),
      ]);
    } on PlayerNotFoundException {
      await public.removePlayers([id]);
    } on Object {
      // Unreachable, so the replica has nothing better to show yet.
    }
  }
  yield* public.watchPlayer(id);
}

/// A bot's catalog row as the identity a seat renders.
Player playerOfBot(Bot bot) => Player(
  id: bot.id,
  username: bot.username,
  displayName: bot.displayName,
  avatarUrl: bot.avatarUrl,
  isAnonymous: false,
);

/// The identity a seat renders: a human's from the replica, a bot's from the
/// catalog. Null for a seat whose account is gone, or while offline for a human
/// the device has never seen.
@riverpod
Future<Player?> seatIdentity(Ref ref, {String? userId, String? botId}) async {
  if (userId != null) {
    return ref.watch(playerIdentityProvider(id: userId).future);
  }
  if (botId == null) return null;
  final bots = await ref.watch(availableBotsProvider.future);
  final bot = bots.where((candidate) => candidate.id == botId).firstOrNull;
  return bot == null ? null : playerOfBot(bot);
}
