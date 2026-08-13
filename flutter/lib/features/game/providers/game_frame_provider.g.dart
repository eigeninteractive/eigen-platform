// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'game_frame_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning
/// The [GameRules] version unit for a specific game, resolved once from the
/// game's immutable schema version.
///
/// This is the single version-dispatch point on the client: everything
/// downstream (engine, content, bots, seatability) consumes the resolved unit
/// and never branches on version.

@ProviderFor(gameRules)
final gameRulesProvider = GameRulesFamily._();

/// The [GameRules] version unit for a specific game, resolved once from the
/// game's immutable schema version.
///
/// This is the single version-dispatch point on the client: everything
/// downstream (engine, content, bots, seatability) consumes the resolved unit
/// and never branches on version.

final class GameRulesProvider
    extends
        $FunctionalProvider<
          AsyncValue<GameRules<dynamic, dynamic, dynamic>>,
          GameRules<dynamic, dynamic, dynamic>,
          FutureOr<GameRules<dynamic, dynamic, dynamic>>
        >
    with
        $FutureModifier<GameRules<dynamic, dynamic, dynamic>>,
        $FutureProvider<GameRules<dynamic, dynamic, dynamic>> {
  /// The [GameRules] version unit for a specific game, resolved once from the
  /// game's immutable schema version.
  ///
  /// This is the single version-dispatch point on the client: everything
  /// downstream (engine, content, bots, seatability) consumes the resolved unit
  /// and never branches on version.
  GameRulesProvider._({
    required GameRulesFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'gameRulesProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$gameRulesHash();

  @override
  String toString() {
    return r'gameRulesProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<GameRules<dynamic, dynamic, dynamic>> $createElement(
    $ProviderPointer pointer,
  ) => $FutureProviderElement(pointer);

  @override
  FutureOr<GameRules<dynamic, dynamic, dynamic>> create(Ref ref) {
    final argument = this.argument as String;
    return gameRules(ref, gameId: argument);
  }

  @override
  bool operator ==(Object other) {
    return other is GameRulesProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$gameRulesHash() => r'edff788cc12ce8f245935aa140a22273380941d2';

/// The [GameRules] version unit for a specific game, resolved once from the
/// game's immutable schema version.
///
/// This is the single version-dispatch point on the client: everything
/// downstream (engine, content, bots, seatability) consumes the resolved unit
/// and never branches on version.

final class GameRulesFamily extends $Family
    with
        $FunctionalFamilyOverride<
          FutureOr<GameRules<dynamic, dynamic, dynamic>>,
          String
        > {
  GameRulesFamily._()
    : super(
        retry: null,
        name: r'gameRulesProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// The [GameRules] version unit for a specific game, resolved once from the
  /// game's immutable schema version.
  ///
  /// This is the single version-dispatch point on the client: everything
  /// downstream (engine, content, bots, seatability) consumes the resolved unit
  /// and never branches on version.

  GameRulesProvider call({required String gameId}) =>
      GameRulesProvider._(argument: gameId, from: this);

  @override
  String toString() => r'gameRulesProvider';
}

/// The parsed game config, produced once from the immutable config payload.
///
/// Config is set at creation and never mutated, so this is long-lived and
/// stands apart from the per-frame [GameFrame]. Erased to [Object] here - the
/// game casts to its concrete type.

@ProviderFor(gameConfig)
final gameConfigProvider = GameConfigFamily._();

/// The parsed game config, produced once from the immutable config payload.
///
/// Config is set at creation and never mutated, so this is long-lived and
/// stands apart from the per-frame [GameFrame]. Erased to [Object] here - the
/// game casts to its concrete type.

final class GameConfigProvider
    extends $FunctionalProvider<AsyncValue<Object>, Object, FutureOr<Object>>
    with $FutureModifier<Object>, $FutureProvider<Object> {
  /// The parsed game config, produced once from the immutable config payload.
  ///
  /// Config is set at creation and never mutated, so this is long-lived and
  /// stands apart from the per-frame [GameFrame]. Erased to [Object] here - the
  /// game casts to its concrete type.
  GameConfigProvider._({
    required GameConfigFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'gameConfigProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$gameConfigHash();

  @override
  String toString() {
    return r'gameConfigProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $FutureProviderElement<Object> $createElement($ProviderPointer pointer) =>
      $FutureProviderElement(pointer);

  @override
  FutureOr<Object> create(Ref ref) {
    final argument = this.argument as String;
    return gameConfig(ref, gameId: argument);
  }

  @override
  bool operator ==(Object other) {
    return other is GameConfigProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$gameConfigHash() => r'6be246f6f929069813046eaa21c2730502538a23';

/// The parsed game config, produced once from the immutable config payload.
///
/// Config is set at creation and never mutated, so this is long-lived and
/// stands apart from the per-frame [GameFrame]. Erased to [Object] here - the
/// game casts to its concrete type.

final class GameConfigFamily extends $Family
    with $FunctionalFamilyOverride<FutureOr<Object>, String> {
  GameConfigFamily._()
    : super(
        retry: null,
        name: r'gameConfigProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// The parsed game config, produced once from the immutable config payload.
  ///
  /// Config is set at creation and never mutated, so this is long-lived and
  /// stands apart from the per-frame [GameFrame]. Erased to [Object] here - the
  /// game casts to its concrete type.

  GameConfigProvider call({required String gameId}) =>
      GameConfigProvider._(argument: gameId, from: this);

  @override
  String toString() => r'gameConfigProvider';
}

/// The per-frame [GameFrame] the game renders from.
///
/// Null before the game is under way: frames only exist from v0 of an active
/// game onward, and there is nothing to project in the waiting room or after an
/// abort.
///
/// The parsed config is intentionally not part of this; consume it separately
/// via [gameConfig].

@ProviderFor(gameFrame)
final gameFrameProvider = GameFrameFamily._();

/// The per-frame [GameFrame] the game renders from.
///
/// Null before the game is under way: frames only exist from v0 of an active
/// game onward, and there is nothing to project in the waiting room or after an
/// abort.
///
/// The parsed config is intentionally not part of this; consume it separately
/// via [gameConfig].

final class GameFrameProvider
    extends $FunctionalProvider<GameFrame?, GameFrame?, GameFrame?>
    with $Provider<GameFrame?> {
  /// The per-frame [GameFrame] the game renders from.
  ///
  /// Null before the game is under way: frames only exist from v0 of an active
  /// game onward, and there is nothing to project in the waiting room or after an
  /// abort.
  ///
  /// The parsed config is intentionally not part of this; consume it separately
  /// via [gameConfig].
  GameFrameProvider._({
    required GameFrameFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'gameFrameProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$gameFrameHash();

  @override
  String toString() {
    return r'gameFrameProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $ProviderElement<GameFrame?> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  GameFrame? create(Ref ref) {
    final argument = this.argument as String;
    return gameFrame(ref, gameId: argument);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(GameFrame? value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<GameFrame?>(value),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is GameFrameProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$gameFrameHash() => r'2c3bc7b88d6e3f90efbc150c6e975adb2c6d2a16';

/// The per-frame [GameFrame] the game renders from.
///
/// Null before the game is under way: frames only exist from v0 of an active
/// game onward, and there is nothing to project in the waiting room or after an
/// abort.
///
/// The parsed config is intentionally not part of this; consume it separately
/// via [gameConfig].

final class GameFrameFamily extends $Family
    with $FunctionalFamilyOverride<GameFrame?, String> {
  GameFrameFamily._()
    : super(
        retry: null,
        name: r'gameFrameProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// The per-frame [GameFrame] the game renders from.
  ///
  /// Null before the game is under way: frames only exist from v0 of an active
  /// game onward, and there is nothing to project in the waiting room or after an
  /// abort.
  ///
  /// The parsed config is intentionally not part of this; consume it separately
  /// via [gameConfig].

  GameFrameProvider call({required String gameId}) =>
      GameFrameProvider._(argument: gameId, from: this);

  @override
  String toString() => r'gameFrameProvider';
}

/// The step from the frame the player last saw to the one on screen now, or
/// null when there is no step to animate.
///
/// This is the input a game animates from, so that "did I render the
/// predecessor" stops being something every game re-derives in widget state. It
/// is null exactly when animating would be wrong: a cold load, a rejoin, or the
/// opening frame, where the cue is history rather than an event and belongs on
/// screen statically.

@ProviderFor(gameTransition)
final gameTransitionProvider = GameTransitionFamily._();

/// The step from the frame the player last saw to the one on screen now, or
/// null when there is no step to animate.
///
/// This is the input a game animates from, so that "did I render the
/// predecessor" stops being something every game re-derives in widget state. It
/// is null exactly when animating would be wrong: a cold load, a rejoin, or the
/// opening frame, where the cue is history rather than an event and belongs on
/// screen statically.

final class GameTransitionProvider
    extends
        $FunctionalProvider<GameTransition?, GameTransition?, GameTransition?>
    with $Provider<GameTransition?> {
  /// The step from the frame the player last saw to the one on screen now, or
  /// null when there is no step to animate.
  ///
  /// This is the input a game animates from, so that "did I render the
  /// predecessor" stops being something every game re-derives in widget state. It
  /// is null exactly when animating would be wrong: a cold load, a rejoin, or the
  /// opening frame, where the cue is history rather than an event and belongs on
  /// screen statically.
  GameTransitionProvider._({
    required GameTransitionFamily super.from,
    required String super.argument,
  }) : super(
         retry: null,
         name: r'gameTransitionProvider',
         isAutoDispose: true,
         dependencies: null,
         $allTransitiveDependencies: null,
       );

  @override
  String debugGetCreateSourceHash() => _$gameTransitionHash();

  @override
  String toString() {
    return r'gameTransitionProvider'
        ''
        '($argument)';
  }

  @$internal
  @override
  $ProviderElement<GameTransition?> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  GameTransition? create(Ref ref) {
    final argument = this.argument as String;
    return gameTransition(ref, gameId: argument);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(GameTransition? value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<GameTransition?>(value),
    );
  }

  @override
  bool operator ==(Object other) {
    return other is GameTransitionProvider && other.argument == argument;
  }

  @override
  int get hashCode {
    return argument.hashCode;
  }
}

String _$gameTransitionHash() => r'93071bc725434be86c94655b2fc5e3b236fe4dc5';

/// The step from the frame the player last saw to the one on screen now, or
/// null when there is no step to animate.
///
/// This is the input a game animates from, so that "did I render the
/// predecessor" stops being something every game re-derives in widget state. It
/// is null exactly when animating would be wrong: a cold load, a rejoin, or the
/// opening frame, where the cue is history rather than an event and belongs on
/// screen statically.

final class GameTransitionFamily extends $Family
    with $FunctionalFamilyOverride<GameTransition?, String> {
  GameTransitionFamily._()
    : super(
        retry: null,
        name: r'gameTransitionProvider',
        dependencies: null,
        $allTransitiveDependencies: null,
        isAutoDispose: true,
      );

  /// The step from the frame the player last saw to the one on screen now, or
  /// null when there is no step to animate.
  ///
  /// This is the input a game animates from, so that "did I render the
  /// predecessor" stops being something every game re-derives in widget state. It
  /// is null exactly when animating would be wrong: a cold load, a rejoin, or the
  /// opening frame, where the cue is history rather than an event and belongs on
  /// screen statically.

  GameTransitionProvider call({required String gameId}) =>
      GameTransitionProvider._(argument: gameId, from: this);

  @override
  String toString() => r'gameTransitionProvider';
}
