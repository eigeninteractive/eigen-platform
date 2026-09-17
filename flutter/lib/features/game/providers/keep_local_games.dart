import 'package:eigen_flutter/core/replica/replica_host.dart';
import 'package:eigen_flutter/core/replica/replica_providers.dart';
import 'package:eigen_flutter/core/storage/shared_preferences_provider.dart';
import 'package:eigen_flutter/features/auth/providers/auth_providers.dart';
import 'package:eigen_flutter/features/game/providers/game_providers.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'keep_local_games.g.dart';

/// Whether this app has already offered to keep local games, whatever the
/// answer was. Asking twice is asking too often.
const _offeredKey = 'eigen.storage_persistence_offered';

/// Offering to have the browser keep this device's games (decision 0014).
///
/// A browser may clear a site's storage when it runs short of space. Replicated
/// rows come back with the next sync; a game played on this device and not yet
/// uploaded does not, so it is worth asking the browser to keep them. Some
/// browsers ask the player in turn, which is why this is an offer the app
/// explains rather than a call at startup, and why it is made once.
///
/// [build] answers whether to make the offer: only where the browser has not
/// already granted or refused, where it has not been made before, and while the
/// account holds a game this device has not uploaded. Always false on a device,
/// which evicts nothing.
@riverpod
class KeepLocalGames extends _$KeepLocalGames {
  @override
  Future<bool> build() async {
    final userId = ref.watch(currentUserIdProvider);
    if (userId == null) return false;
    final host = await ref.watch(replicaHostProvider.future);
    if (await host.persistence() != StoragePersistence.askable) return false;
    final preferences = await ref.watch(sharedPreferencesProvider.future);
    if (preferences.getBool(_offeredKey) ?? false) return false;
    // Re-read as games come and go: the offer belongs with a game at stake.
    ref.watch(activeGamesProvider);
    final storage = await ref.watch(localGameStorageProvider.future);
    return (await storage.unsynced(userId)).isNotEmpty;
  }

  /// Asks the browser to keep this site's storage, and answers what it decided.
  Future<StoragePersistence> keep() async {
    final host = await ref.read(replicaHostProvider.future);
    // Before anything that could outlast the tap: a browser that asks the
    // player will only do so while the tap still counts as one.
    final decision = await host.requestPersistence();
    await _offered();
    return decision;
  }

  /// Leaves the storage as it is, and does not offer again.
  Future<void> dismiss() => _offered();

  Future<void> _offered() async {
    final preferences = await ref.read(sharedPreferencesProvider.future);
    await preferences.setBool(_offeredKey, true);
    ref.invalidateSelf();
  }
}
