// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'keep_local_games.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
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

@ProviderFor(KeepLocalGames)
final keepLocalGamesProvider = KeepLocalGamesProvider._();

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
final class KeepLocalGamesProvider
    extends $AsyncNotifierProvider<KeepLocalGames, bool> {
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
  KeepLocalGamesProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'keepLocalGamesProvider',
        isAutoDispose: true,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$keepLocalGamesHash();

  @$internal
  @override
  KeepLocalGames create() => KeepLocalGames();
}

String _$keepLocalGamesHash() => r'a2c3059af1f74c4c2ade27b72f9a7b73be174306';

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

abstract class _$KeepLocalGames extends $AsyncNotifier<bool> {
  FutureOr<bool> build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref = this.ref as $Ref<AsyncValue<bool>, bool>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<AsyncValue<bool>, bool>,
              AsyncValue<bool>,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
