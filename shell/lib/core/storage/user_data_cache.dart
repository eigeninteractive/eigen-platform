import 'package:eigen_flutter/shell_support.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

/// Returns the storage key used to persist a user's own profile.
String profileCacheKey(String userId) => 'profile_$userId';

/// Returns the storage key used to persist a user's friendships list.
String friendshipsCacheKey(String userId) => 'friendships_$userId';

/// Deletes all first-party shell data persisted for [userId].
Future<void> deleteUserData(Ref ref, String userId) async {
  if (!persistentApiCacheEnabled) return;
  final storage = await ref.read(storageProvider.future);
  await storage.delete(profileCacheKey(userId));
  await storage.delete(friendshipsCacheKey(userId));
}
