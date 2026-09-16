// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'rating_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(ratingRepository)
final ratingRepositoryProvider = RatingRepositoryProvider._();

final class RatingRepositoryProvider
    extends
        $FunctionalProvider<
          RatingRepository,
          RatingRepository,
          RatingRepository
        >
    with $Provider<RatingRepository> {
  RatingRepositoryProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'ratingRepositoryProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$ratingRepositoryHash();

  @$internal
  @override
  $ProviderElement<RatingRepository> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  RatingRepository create(Ref ref) {
    return ratingRepository(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(RatingRepository value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<RatingRepository>(value),
    );
  }
}

String _$ratingRepositoryHash() => r'b0e88ea45b61207b0b252143d3fae926730dcbf6';

/// All pool ratings for `id`, best first: humans and bots alike.
///
/// Shown from the replica straight away, and refreshed from the server each
/// time something starts watching, so another player's sheet opens instantly
/// and offline, and is current when it can be.

@ProviderFor(playerRatings)
final playerRatingsProvider = PlayerRatingsFamily._();

/// All pool ratings for `id`, best first: humans and bots alike.
///
/// Shown from the replica straight away, and refreshed from the server each
/// time something starts watching, so another player's sheet opens instantly
/// and offline, and is current when it can be.

final class PlayerRatingsProvider
    extends
        $FunctionalProvider<
          AsyncValue<List<Rating>>,
          List<Rating>,
          Stream<List<Rating>>
        >
    with $FutureModifier<List<Rating>>, $StreamProvider<List<Rating>> {
  /// All pool ratings for `id`, best first: humans and bots alike.
  ///
  /// Shown from the replica straight away, and refreshed from the server each
  /// time something starts watching, so another player's sheet opens instantly
  /// and offline, and is current when it can be.
  PlayerRatingsProvider._({
    required PlayerRatingsFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'playerRatingsProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$playerRatingsHash();

  @override
  String toString() {
    return r'playerRatingsProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $StreamProviderElement<List<Rating>> $createElement(
    $ProviderPointer pointer,
  ) => $StreamProviderElement(pointer);

  @override
  Stream<List<Rating>> create(Ref ref) {
    final argument = this.argument as String;
    return playerRatings(ref, argument);
  }

  @override
  bool operator ==(Object other) {
    return other is PlayerRatingsProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$playerRatingsHash() => r'aaec269b2eed2dd2e89407d470fb5deb28e68db0';

/// All pool ratings for `id`, best first: humans and bots alike.
///
/// Shown from the replica straight away, and refreshed from the server each
/// time something starts watching, so another player's sheet opens instantly
/// and offline, and is current when it can be.

final class PlayerRatingsFamily extends $Family
    with $FunctionalFamilyOverride<Stream<List<Rating>>, String> {
  PlayerRatingsFamily._()
    : super(
        retry: null,
        name: r'playerRatingsProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// All pool ratings for `id`, best first: humans and bots alike.
  ///
  /// Shown from the replica straight away, and refreshed from the server each
  /// time something starts watching, so another player's sheet opens instantly
  /// and offline, and is current when it can be.

  PlayerRatingsProvider call(String id) =>
      PlayerRatingsProvider._(argument: id, from: this);

  @override
  String toString() => r'playerRatingsProvider';
}
