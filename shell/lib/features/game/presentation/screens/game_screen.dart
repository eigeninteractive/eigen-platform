import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/core/review/review_notifier.dart';
import 'package:eigen_shell/core/updates/required_update_button.dart';
import 'package:eigen_shell/core/utils/deep_links.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_shell/core/notifications/game_notification_nudge.dart';
import 'package:eigen_shell/features/game/presentation/widgets/budget_clock.dart';
import 'package:eigen_shell/features/game/presentation/widgets/turn_countdown.dart';

import 'package:eigen_shell/features/social/presentation/widgets/player_profile_sheet.dart';

part 'game_screen_pre_game.dart';
part 'game_screen_active.dart';
part 'game_screen_states.dart';

/// Screen for playing a game.
///
/// Dispatches on [GameSession.status] before touching the observation stream:
/// - waiting/ready → [_PreGameContent] (no observation needed)
/// - aborted → [_AbortedContent] (no observation needed)
/// - active/finished → [_ActiveGameContent] (session required)
///
/// A single [RefreshIndicator] wraps all branches. Every branch returns a
/// [CustomScrollView] with [AlwaysScrollableScrollPhysics] so pull-to-refresh
/// is detectable even when content is shorter than the viewport.
class GameScreen extends ConsumerStatefulWidget {
  const GameScreen({super.key, required this.gameId});

  final String gameId;

  @override
  ConsumerState<GameScreen> createState() => _GameScreenState();
}

enum _PendingAction {
  starting,
  submittingAction,
  cancelling,
  forfeiting,
  leaving,
}

class _GameScreenState extends ConsumerState<GameScreen> {
  _PendingAction? _pendingAction;
  bool _errorSnackBarShown = false;
  final Set<String> _reportedCompatibility = {};
  late final AppLifecycleListener _lifecycleListener;
  late final ProviderSubscription<AsyncValue<GameSession>> _sessionSub;
  late final ProviderSubscription<List<Outcome>> _outcomesSub;
  late final ProviderSubscription<bool> _offlineSub;
  late final ProviderSubscription<GameWireCompatibility> _compatibilitySub;

  @override
  void initState() {
    super.initState();
    _lifecycleListener = AppLifecycleListener(onResume: _invalidateStreams);
    // Analytics listeners registered once here so they are independent of the
    // build cycle and don't mix side-effects into the build method.
    // Registered before the build-cycle listeners so they read player count
    // before gamePlayersProvider is invalidated on status change.
    _sessionSub = ref.listenManual(
      gameSessionProvider(gameId: widget.gameId),
      _onSession,
    );
    _outcomesSub = ref.listenManual(
      gameOutcomesProvider(gameId: widget.gameId),
      _onOutcomes,
    );
    _offlineSub = ref.listenManual(isOfflineProvider, _onConnectivityChange);
    _compatibilitySub = ref.listenManual(
      gameWireCompatibilityProvider(gameId: widget.gameId),
      _onCompatibilityChange,
      fireImmediately: true,
    );
  }

  /// One listener for the one stream: analytics on a witnessed transition, and
  /// clearing the in-flight marker when a move's own session lands.
  void _onSession(AsyncValue<GameSession>? prev, AsyncValue<GameSession> next) {
    if (!mounted) return;
    _onSessionError(prev, next);
    final prevVersion = prev?.value?.version;
    final version = next.value?.version;
    if (version != null &&
        version != prevVersion &&
        _pendingAction == _PendingAction.submittingAction) {
      setState(() => _pendingAction = null);
    }
    _onGameStatusChange(prev?.value?.status, next.value?.status);
  }

  void _onGameStatusChange(GameStatus? prevStatus, GameStatus? status) {
    if (prevStatus == status) return;

    // Fire game_started only on a witnessed pre-game → active transition.
    // prevStatus is null on the first load after mounting, so merely opening
    // an already-active game does not re-count the start.
    if (status == GameStatus.active &&
        (prevStatus == GameStatus.waiting || prevStatus == GameStatus.ready)) {
      // Read player count before invalidating below so the cached value is
      // still available for the analytics call.
      final count =
          ref
              .read(gamePlayersProvider(gameId: widget.gameId))
              .value
              ?.players
              .length ??
          0;
      unawaited(
        ref
            .read(analyticsServiceProvider)
            .gameStarted(gameId: widget.gameId, playerCount: count),
      );
    }

    // Nothing to invalidate: the roster and the outcomes are projections of
    // the session that just changed, so they have already re-derived.
  }

  void _onOutcomes(List<Outcome>? prev, List<Outcome> next) {
    // Side effects fire only on a witnessed empty → non-empty transition, so
    // re-opening a finished game does not re-fire them. `prev` is null on the
    // first read, which is that case.
    if (prev?.isEmpty != true || next.isEmpty) return;
    unawaited(
      ref.read(analyticsServiceProvider).gameFinished(gameId: widget.gameId),
    );
    _maybeRequestReview(next);
    _maybeTriggerWinHaptic(next);
  }

  void _maybeTriggerWinHaptic(List<Outcome> outcomes) {
    final mySeat = ref
        .read(gamePlayersProvider(gameId: widget.gameId))
        .value
        ?.mySeat;
    if (mySeat is! Seated) return;
    final didWin = outcomes.any(
      (o) => o.playerIndex == mySeat.index && o.result == OutcomeResultEnum.win,
    );
    if (didWin) unawaited(HapticFeedback.heavyImpact());
  }

  /// Snackbar handling for the session stream's error state.
  ///
  /// Split out of [_onSession] only for length: it is the same stream. Riverpod
  /// 3.x carries the previous value through AsyncLoading and AsyncError, so the
  /// in-flight marker is cleared off the version changing rather than off the
  /// state, which a pull-to-refresh or an app resume would otherwise clear
  /// prematurely.
  void _onSessionError(
    AsyncValue<GameSession>? prev,
    AsyncValue<GameSession> next,
  ) {
    switch (next) {
      case AsyncData():
        if (_errorSnackBarShown) {
          _errorSnackBarShown = false;
          ScaffoldMessenger.of(context).clearSnackBars();
        }
      case AsyncError():
        if (_pendingAction == _PendingAction.submittingAction) {
          setState(() => _pendingAction = null);
        }
        // One snackbar per error episode, terminal or not, since Riverpod's retry
        // cycle would otherwise re-show it on every failed attempt. The flag
        // resets on the next successful snapshot.
        if (_errorSnackBarShown) return;
        _errorSnackBarShown = true;
        final isTerminal = next.value?.isTerminal ?? false;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              isTerminal
                  ? 'This game has ended.'
                  : 'Connection lost. Retrying…',
            ),
            action: isTerminal
                ? SnackBarAction(
                    label: 'Back to Home',
                    onPressed: () => context.go('/home'),
                  )
                : SnackBarAction(label: 'Retry', onPressed: _invalidateStreams),
            duration: const Duration(seconds: 10),
          ),
        );
      default:
        break;
    }
  }

  void _onConnectivityChange(bool? wasOffline, bool isOffline) {
    if (wasOffline != true || isOffline) return;
    // Network restored, so re-subscribe immediately for the fast
    // offline→online transition.
    _invalidateStreams();
  }

  /// Re-subscribes the live session immediately, bypassing Riverpod's retry
  /// backoff.
  ///
  /// One stream to re-establish, and the snapshot it opens with restates
  /// everything the screen shows, so there is nothing else to refresh: status,
  /// roster, frame and outcomes are all projections of it.
  void _invalidateStreams() {
    ref.invalidate(gameSessionProvider(gameId: widget.gameId));
  }

  void _maybeRequestReview(List<Outcome> outcomes) {
    final mySeat = ref
        .read(gamePlayersProvider(gameId: widget.gameId))
        .value
        ?.mySeat;
    if (mySeat is! Seated) return;

    final myOutcome = outcomes
        .where((o) => o.playerIndex == mySeat.index)
        .firstOrNull;
    if (myOutcome?.result != OutcomeResultEnum.win) return;

    unawaited(ref.read(reviewProvider.notifier).onWin());
  }

  @override
  void dispose() {
    _sessionSub.close();
    _outcomesSub.close();
    _offlineSub.close();
    _compatibilitySub.close();
    _lifecycleListener.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final sessionAsync = ref.watch(gameSessionProvider(gameId: widget.gameId));
    final compatibility = ref.watch(
      gameWireCompatibilityProvider(gameId: widget.gameId),
    );
    return Scaffold(
      body: Column(
        children: [
          _ReconnectingBannerSlot(gameId: widget.gameId),
          Expanded(
            child: SafeArea(
              child: switch (sessionAsync) {
                // value is non-null for AsyncData and for AsyncError with
                // stale data: keep showing the game while the banner
                // communicates the reconnecting state.
                _ when sessionAsync.value != null => RefreshIndicator(
                  onRefresh: _onRefresh,
                  child: compatibility.requiresUpdate
                      ? const _UpdateRequiredScroll()
                      : _GameBody(
                          session: sessionAsync.value!,
                          pendingAction: _pendingAction,
                          onStartGame: _startGame,
                          onCancelGame: _cancelGame,
                          onLeaveGame: _leaveGame,
                          onAction: _submitAction,
                          onForfeit: _forfeitGame,
                        ),
                ),
                AsyncError(:final error) => _ErrorState(
                  error: humanize(error),
                  onRetry: _retryConnection,
                ),
                _ => const Center(child: CircularProgressIndicator()),
              },
            ),
          ),
        ],
      ),
    );
  }

  void _onCompatibilityChange(
    GameWireCompatibility? _,
    GameWireCompatibility next,
  ) {
    if (next.unknownStatus) _reportCompatibility('GameStatus');
    if (next.unknownSeatType) _reportCompatibility('SeatType');
    if (next.unknownFrameType) _reportCompatibility('FrameType');
    if (next.unknownAccess) _reportCompatibility('GameAccess');
  }

  void _reportCompatibility(String enumType) {
    if (!_reportedCompatibility.add(enumType)) return;
    unawaited(
      ref
          .read(analyticsServiceProvider)
          .wireEnumFallback(enumType: enumType, surface: 'game'),
    );
  }

  void _retryConnection() => _invalidateStreams();

  Future<void> _onRefresh() async {
    _invalidateStreams();
    await ref.read(gameSessionProvider(gameId: widget.gameId).future);
  }

  /// The caller's own seat, or null when they are only watching.
  ///
  /// Every state-changing command carries it: the server verifies the named
  /// seat against its roster rather than resolving one for the caller, so a
  /// seat nobody holds is a clean rejection instead of a guess.
  int? _mySeat() {
    final seat = ref
        .read(gamePlayersProvider(gameId: widget.gameId))
        .value
        ?.mySeat;
    return seat is Seated ? seat.index : null;
  }

  /// Submits an action and reports the outcome to the game's content widget
  /// (via [GameContentContext.onAction]). Error display stays here; the game
  /// only uses the [ActionSubmitResult] to manage optimistic rendering.
  ///
  /// An [EngineException] is a definitive server verdict → [rejected]; any
  /// other failure is transport-shaped, so the server may still have
  /// committed → [unconfirmed].
  Future<ActionSubmitResult> _submitAction(
    Map<String, dynamic> actionJson,
    int gameVersion,
  ) async {
    if (_pendingAction == _PendingAction.submittingAction) {
      return ActionSubmitResult.rejected;
    }
    unawaited(HapticFeedback.lightImpact());
    setState(() => _pendingAction = _PendingAction.submittingAction);

    try {
      final seat = _mySeat();
      if (seat == null) {
        if (mounted) setState(() => _pendingAction = null);
        return ActionSubmitResult.rejected;
      }
      await ref
          .read(gameRepositoryProvider)
          .submitAction(
            gameId: widget.gameId,
            seat: seat,
            data: actionJson,
            expectedVersion: gameVersion,
          );
      // Keep _pendingAction = submittingAction on success.
      // The observation listener resets it when the confirming update arrives.
      return ActionSubmitResult.committed;
    } on EngineException catch (e) {
      _onSubmitFailed(e);
      return ActionSubmitResult.rejected;
    } catch (e) {
      _onSubmitFailed(e);
      return ActionSubmitResult.unconfirmed;
    }
  }

  void _onSubmitFailed(Object e) {
    if (!mounted) return;
    setState(() => _pendingAction = null);
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(humanize(e))));
  }

  Future<void> _cancelGame() async {
    setState(() => _pendingAction = _PendingAction.cancelling);
    try {
      await ref.read(gameRepositoryProvider).cancelGame(widget.gameId);
      if (!mounted) return;
      context.go('/home');
    } catch (e) {
      if (!mounted) return;
      setState(() => _pendingAction = null);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(humanize(e))));
    }
  }

  Future<void> _leaveGame() async {
    setState(() => _pendingAction = _PendingAction.leaving);
    try {
      await ref.read(gameRepositoryProvider).leaveGame(widget.gameId);
      if (!mounted) return;
      context.go('/home');
    } catch (e) {
      if (!mounted) return;
      setState(() => _pendingAction = null);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(humanize(e))));
    }
  }

  Future<void> _startGame() async {
    setState(() => _pendingAction = _PendingAction.starting);
    try {
      await ref.read(gameRepositoryProvider).startGame(widget.gameId);
      if (mounted) setState(() => _pendingAction = null);
    } catch (e) {
      if (!mounted) return;
      setState(() => _pendingAction = null);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(humanize(e))));
    }
  }

  Future<void> _forfeitGame() async {
    setState(() => _pendingAction = _PendingAction.forfeiting);
    try {
      final seat = _mySeat();
      if (seat == null) {
        if (mounted) setState(() => _pendingAction = null);
        return;
      }
      await ref
          .read(gameRepositoryProvider)
          .forfeitGame(gameId: widget.gameId, seat: seat);
      if (mounted) {
        setState(() => _pendingAction = null);
        unawaited(ref.read(analyticsServiceProvider).forfeit());
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _pendingAction = null);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(humanize(e))));
    }
  }
}

/// Routes game status to the correct scroll branch.
///
/// All branches return a [CustomScrollView] with [AlwaysScrollableScrollPhysics]
/// so the parent [RefreshIndicator] can detect a pull in every game state.
///
/// A pure routing widget; provider subscriptions are owned by the leaf
/// widgets ([_PreGameContent], [_ActiveGameContent]) so observation updates
/// only rebuild the subtree that needs them.
class _GameBody extends StatelessWidget {
  const _GameBody({
    required this.session,
    required this.pendingAction,
    required this.onStartGame,
    required this.onCancelGame,
    required this.onLeaveGame,
    required this.onAction,
    required this.onForfeit,
  });

  /// The live session. Its status is what routes below, so the board and the
  /// waiting room can never disagree about which one the game is in.
  final GameSession session;

  /// The in-flight user operation, if any. Leaf widgets receive the specific
  /// booleans they need, derived here.
  final _PendingAction? pendingAction;
  final VoidCallback onStartGame;
  final VoidCallback onCancelGame;
  final VoidCallback onLeaveGame;
  final Future<ActionSubmitResult> Function(Map<String, dynamic>, int) onAction;
  final Future<void> Function() onForfeit;

  @override
  Widget build(BuildContext context) {
    switch (session.status) {
      case GameStatus.waiting:
      case GameStatus.ready:
        return CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverFillRemaining(
              hasScrollBody: false,
              child: _PreGameContent(
                session: session,
                isStartingGame: pendingAction == _PendingAction.starting,
                isCancelling: pendingAction == _PendingAction.cancelling,
                isLeaving: pendingAction == _PendingAction.leaving,
                onStartGame: onStartGame,
                onCancelGame: onCancelGame,
                onLeaveGame: onLeaveGame,
              ),
            ),
          ],
        );

      case GameStatus.aborted:
        return const CustomScrollView(
          physics: AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverFillRemaining(hasScrollBody: false, child: _AbortedContent()),
          ],
        );

      case GameStatus.unknownDefaultOpenApi:
        return const _UpdateRequiredScroll();

      case GameStatus.active:
      case GameStatus.finished:
        return CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverFillRemaining(
              hasScrollBody: false,
              child: _ActiveGameContent(
                session: session,
                isSubmittingAction:
                    pendingAction == _PendingAction.submittingAction,
                isForfeiting: pendingAction == _PendingAction.forfeiting,
                onAction: onAction,
                onForfeit: onForfeit,
              ),
            ),
          ],
        );
    }
  }
}
