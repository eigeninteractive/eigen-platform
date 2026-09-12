import 'package:eigen_flutter/shell_support.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

/// Returns the storage key used to persist a user's own profile.
String profileCacheKey(String userId) => 'profile_$userId';

/// Returns the storage key used to persist a user's friendships list.
String friendshipsCacheKey(String userId) => 'friendships_$userId';

/// Deletes all first-party shell data persisted for [userId].
///
/// Caches only. Games this device played offline are deliberately not touched:
/// they are the games themselves, not a copy of something the server holds, and
/// a sign-out is not a decision to discard them. [deleteLocalGamesFor] is what
/// account deletion calls.
Future<void> deleteUserData(Ref ref, String userId) async {
  if (!persistentApiCacheEnabled) return;
  final storage = await ref.read(storageProvider.future);
  await storage.delete(profileCacheKey(userId));
  await storage.delete(friendshipsCacheKey(userId));
}

/// Deletes every game [userId] played on this device.
///
/// Account deletion only. An account's local games are its own: nothing else
/// can open them, and the server's copies of the ones that synchronized are
/// anonymized by the same deletion that brought us here.
Future<void> deleteLocalGamesFor(Ref ref, String userId) async {
  final store = await ref.read(localGameStoreProvider.future);
  if (store is DriftLocalGameStore) {
    await store.deleteFor(userId);
    return;
  }
  for (final record in await store.list(userId)) {
    await store.delete(record.id);
  }
}
