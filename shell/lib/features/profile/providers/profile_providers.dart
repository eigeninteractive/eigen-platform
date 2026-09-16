import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'profile_providers.g.dart';

/// Provider for the signed-in account's repository.
@Riverpod(keepAlive: true)
AccountRepository accountRepository(Ref ref) {
  return ref.watch(engineClientProvider).account;
}

/// Provider for AvatarStorageService instance.
@Riverpod(keepAlive: true)
AvatarStorageService avatarStorageService(Ref ref) {
  return ref.watch(engineClientProvider).avatar;
}

/// The signed-in user's own profile, from the replica.
///
/// Answers straight away from what the device holds, offline included, and
/// waits for the first sync on a device that holds nothing yet.
@riverpod
Stream<Profile> currentUserProfile(Ref ref) async* {
  final replica = await ref.watch(accountReplicaProvider.future);
  if (replica == null) return;
  await for (final profile in replica.watchProfile()) {
    if (profile != null) yield profile;
  }
}

/// Changes to the signed-in user's profile.
///
/// Every change answers with the whole updated profile, which is written to
/// the replica as it arrives: the server derives fields the client does not
/// send (it stamps `avatarUrl` itself on upload, cache-buster included), so the
/// replica holds what every other client sees rather than a local patch, and a
/// change that half-succeeded holds exactly the half that did.
@riverpod
class ProfileEditor extends _$ProfileEditor {
  @override
  void build() {}

  /// Uploads [bytes] as the user's new avatar.
  Future<void> uploadAvatar(Uint8List bytes) async {
    final current = await ref.read(currentUserProfileProvider.future);
    // Evict the old image before uploading. The new URL carries a fresh
    // cache-buster so the old entry would never be requested again anyway;
    // evicting reclaims disk and memory now instead of at LRU expiry.
    final oldUrl = resolveAvatarUrl(
      current.avatarUrl,
      ref.read(appConfigProvider).engine.apiBaseUrl,
    );
    if (oldUrl != null) await CachedNetworkImageProvider(oldUrl).evict();
    await _apply(
      await ref.read(avatarStorageServiceProvider).uploadAvatar(bytes),
    );
  }

  /// Applies whichever of [username] and [displayName] actually changed.
  ///
  /// The two are separate endpoints because they are different things: the
  /// username is unique and charset-constrained (and so can fail with
  /// [ErrorCode.usernameTaken] or [ErrorCode.usernameInvalid]), while the
  /// display name is free-form and cannot collide.
  Future<void> updateProfileFields({
    String? username,
    String? displayName,
  }) async {
    final current = await ref.read(currentUserProfileProvider.future);
    final repository = ref.read(accountRepositoryProvider);
    if (username != null && username != current.username) {
      await _apply(await repository.updateUsername(username));
    }
    if (displayName != null && displayName != current.displayName) {
      await _apply(await repository.updateDisplayName(displayName));
    }
  }

  Future<void> _apply(Profile profile) async {
    final replica = await ref.read(accountReplicaProvider.future);
    await replica?.applyProfile(profile);
  }
}
