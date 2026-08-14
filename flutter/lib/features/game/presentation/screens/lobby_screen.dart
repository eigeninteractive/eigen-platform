import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';
import 'package:eigen_flutter/core/errors/error_messages.dart';
import 'package:eigen_flutter/core/adaptive/adaptive_layout.dart';
import 'package:eigen_flutter/features/auth/providers/auth_providers.dart';

import 'package:eigen_flutter/features/game/providers/game_providers.dart';
import 'package:eigen_flutter/features/game/utils/game_timing.dart';
import 'package:eigen_flutter/features/game/presentation/widgets/new_game_dialog.dart';
import 'package:eigen_flutter/shared/providers/player_providers.dart';
import 'package:eigen_flutter/shared/widgets/empty_state_view.dart';
import 'package:eigen_flutter/shared/widgets/overlapping_avatars.dart';
import 'package:eigen_api/eigen_api.dart';
import 'package:eigen_flutter/features/social/providers/social_providers.dart';

/// Screen for browsing and joining public games.
class LobbyScreen extends ConsumerStatefulWidget {
  const LobbyScreen({super.key});

  @override
  ConsumerState<LobbyScreen> createState() => _LobbyScreenState();
}

enum _LobbyMode { public, friends }

class _LobbyScreenState extends ConsumerState<LobbyScreen>
    with SingleTickerProviderStateMixin {
  static const _tabNames = ['public', 'friends'];

  // Guests cannot have friends. The Friends tab stays visible but disabled
  // (greyed, with a locked sign-in panel as its content) so guests still see
  // the feature exists, and app_friends_games is never called for them.
  // Decided once at init: a guest→permanent conversion is a full auth-state
  // change that re-navigates into a fresh lobby.
  late final bool _isAnonymous;
  late final TabController _tabController;
  bool _syncingFromRoute = false;
  int? _directTabSelection;

  @override
  void initState() {
    super.initState();
    _isAnonymous = ref.read(isAnonymousProvider);
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(_handleControllerChange);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final routeIndex = _routeTabIndex();
    if (_tabController.index == routeIndex) return;

    // Browser Back/Forward changes the query while this stateful shell branch
    // stays mounted. Update the existing controller without writing the same
    // state back into the router.
    _syncingFromRoute = true;
    _directTabSelection = null;
    _tabController.index = routeIndex;
    _syncingFromRoute = false;
  }

  @override
  void dispose() {
    _tabController
      ..removeListener(_handleControllerChange)
      ..dispose();
    super.dispose();
  }

  int _routeTabIndex() {
    final tab = GoRouterState.of(context).uri.queryParameters['tab'];
    final index = _tabNames.indexOf(tab ?? '');
    return index < 0 ? 0 : index;
  }

  String _locationForTab(int index) {
    final uri = GoRouterState.of(context).uri;
    final query = Map<String, String>.of(uri.queryParameters);
    if (index == 0) {
      query.remove('tab');
    } else {
      query['tab'] = _tabNames[index];
    }
    return uri.replace(queryParameters: query).toString();
  }

  void _handleTabTap(int index) {
    if (index == _routeTabIndex()) {
      _directTabSelection = null;
      return;
    }
    // A deliberate tab click is browser-navigable history. TabBar has already
    // started the controller animation before invoking onTap, so remember it
    // and suppress the completion listener's replace.
    _directTabSelection = index;
    context.go(_locationForTab(index));
  }

  void _handleControllerChange() {
    if (!mounted || _syncingFromRoute || _tabController.indexIsChanging) {
      return;
    }
    final index = _tabController.index;
    if (_directTabSelection == index) {
      _directTabSelection = null;
      return;
    }
    if (index == _routeTabIndex()) return;

    // Swiping the TabBarView (or another controller-driven animation) should
    // expose its state in the URL without adding a second history entry.
    Router.neglect(context, () => context.go(_locationForTab(index)));
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final disabledColor = colorScheme.onSurface.withValues(alpha: 0.38);

    return Column(
      children: [
        TabBar(
          controller: _tabController,
          onTap: _handleTabTap,
          tabs: [
            const Tab(icon: Icon(Icons.public), text: 'Public'),
            Tab(
              icon: Icon(
                Icons.people,
                color: _isAnonymous ? disabledColor : null,
              ),
              child: Text(
                'Friends',
                style: _isAnonymous ? TextStyle(color: disabledColor) : null,
              ),
            ),
          ],
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              const _LobbyTabContent(mode: _LobbyMode.public),
              if (_isAnonymous)
                const _FriendsLockedView()
              else
                const _LobbyTabContent(mode: _LobbyMode.friends),
            ],
          ),
        ),
      ],
    );
  }
}

/// Locked content shown to guests in place of the friends lobby. The Friends
/// tab is visible but non-functional until they create an account, mirroring
/// the disabled "Sign up to play rated" treatment on rated game cards.
class _FriendsLockedView extends StatelessWidget {
  const _FriendsLockedView();

  @override
  Widget build(BuildContext context) {
    return EmptyStateView(
      icon: Icons.lock_outline,
      title: 'Friends games',
      message: 'Sign in to add friends and play private games with them.',
      cta: 'Sign in',
      tonalCta: true,
      onCta: () => context.goNamed('settings'),
    );
  }
}

class _LobbyTabContent extends ConsumerStatefulWidget {
  const _LobbyTabContent({required this.mode});

  final _LobbyMode mode;

  @override
  ConsumerState<_LobbyTabContent> createState() => _LobbyTabContentState();
}

class _LobbyTabContentState extends ConsumerState<_LobbyTabContent>
    with AutomaticKeepAliveClientMixin {
  late final PagingController<String, GameSummary> _pagingController;

  /// The cursor for the page after the one most recently fetched, or null once
  /// the server has said the list is exhausted. The empty string is "no cursor
  /// yet", i.e. the first page; it cannot be null, because null is how this API
  /// says there are no more pages.
  String? _nextKey = '';

  /// Reload from the top.
  ///
  /// The cursor lives beside the controller rather than inside it, so the two
  /// have to be reset together - refreshing without clearing the cursor would
  /// refetch page one and then continue paging from wherever the last scroll
  /// had reached. This screen has five refresh affordances (the toolbar button,
  /// pull-to-refresh, the error retry, and a game being joined or cancelled),
  /// which is exactly why this is a method rather than five copies of two
  /// lines.
  void _refresh() {
    _nextKey = '';
    _pagingController.refresh();
  }

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _pagingController = PagingController<String, GameSummary>(
      getNextPageKey: (state) => _nextKey,
      fetchPage: (key) async {
        final cursor = key.isEmpty ? null : key;
        final page = widget.mode == _LobbyMode.public
            ? await ref.read(gameRepositoryProvider).getLobby(cursor: cursor)
            : await ref
                  .read(socialRepositoryProvider)
                  .getFriendsGames(cursor: cursor);
        _nextKey = page.nextCursor;
        return page.games;
      },
    );
    _pagingController.addListener(_onPagingError);
  }

  void _onPagingError() {
    if (!mounted) return;
    if (_pagingController.value.status == PagingStatus.subsequentPageError) {
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(
              humanize(_pagingController.value.error ?? 'Unknown error'),
            ),
            action: SnackBarAction(
              label: 'Retry',
              onPressed: _pagingController.fetchNextPage,
            ),
          ),
        );
    }
  }

  @override
  void dispose() {
    _pagingController
      ..removeListener(_onPagingError)
      ..dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final colorScheme = Theme.of(context).colorScheme;

    return AdaptiveLayoutBuilder(
      builder: (context, constraints, windowClass) => Column(
        children: [
          Align(
            alignment: Alignment.centerRight,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: IconButton(
                onPressed: _refresh,
                icon: const Icon(Icons.refresh),
                tooltip: 'Refresh games',
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async => _refresh(),
              child: PagingListener(
                controller: _pagingController,
                builder: (context, state, fetchNextPage) {
                  final builderDelegate =
                      PagedChildBuilderDelegate<GameSummary>(
                        animateTransitions: true,
                        itemBuilder: (context, item, index) => _GameCard(
                          key: ValueKey(item.id),
                          game: item,
                          onCancelled: _refresh,
                          onJoined: _refresh,
                        ),
                        noItemsFoundIndicatorBuilder: (_) => EmptyStateView(
                          icon: Icons.sports_esports_outlined,
                          title: 'No open games right now',
                          message: switch (widget.mode) {
                            _LobbyMode.friends =>
                              'None of your friends have an open game.',
                            _LobbyMode.public => 'Be the first to start one.',
                          },
                          cta: 'Create Game',
                          onCta: () => showDialog(
                            context: context,
                            useSafeArea: true,
                            builder: (_) => const NewGameDialog(),
                          ),
                        ),
                        firstPageErrorIndicatorBuilder: (_) => Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.error_outline,
                                size: 48,
                                color: colorScheme.error,
                              ),
                              const SizedBox(height: 16),
                              Text(humanize(state.error ?? 'Unknown error')),
                              const SizedBox(height: 16),
                              FilledButton(
                                onPressed: _refresh,
                                child: const Text('Retry'),
                              ),
                            ],
                          ),
                        ),
                      );
                  final useGrid = shouldUseCardGrid(
                    windowClass: windowClass,
                    textScaler: MediaQuery.textScalerOf(context),
                  );
                  if (!useGrid) {
                    return ConstrainedContentPane(
                      maxWidth: 720,
                      child: PagedListView<String, GameSummary>.separated(
                        state: state,
                        fetchNextPage: fetchNextPage,
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                        separatorBuilder: (_, _) => const SizedBox(height: 12),
                        builderDelegate: builderDelegate,
                      ),
                    );
                  }
                  return PagedGridView<String, GameSummary>(
                    state: state,
                    fetchNextPage: fetchNextPage,
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                    gridDelegate: responsiveCardGridDelegate(
                      availableWidth: constraints.maxWidth - 32,
                      maxCrossAxisExtent: 580,
                      mainAxisExtent: 140,
                      twoColumnWidth: 1000,
                    ),
                    builderDelegate: builderDelegate,
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GameCard extends ConsumerStatefulWidget {
  const _GameCard({
    super.key,
    required this.game,
    required this.onCancelled,
    required this.onJoined,
  });

  final GameSummary game;
  final VoidCallback onCancelled;
  final VoidCallback onJoined;

  @override
  ConsumerState<_GameCard> createState() => _GameCardState();
}

class _GameCardState extends ConsumerState<_GameCard> {
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    final currentUser = ref.watch(currentUserProvider);
    final isOwner = widget.game.createdBy == currentUser?.id;
    // Membership comes off the roster the summary already carries.
    final isParticipant = widget.game.participants.any(
      (p) => p.userId == ref.watch(currentUserIdProvider),
    );
    final canNavigate = isOwner || isParticipant;
    // A game created by a newer build cannot be rendered by this client; refuse
    // to join (and thus seat) it. The server enforces the same check, but
    // disabling the button gives immediate feedback instead of a failed tap.
    final supported = ref
        .watch(currentGameModuleProvider)
        .supportsSchema(widget.game.schemaVersion);
    // Guests play unrated only. The server rejects a guest joining a rated game;
    // disabling the button (rather than hiding the game) gives immediate
    // feedback and nudges them to sign up, mirroring the unsupported case.
    final ratedBlockedForGuest =
        widget.game.rated && ref.watch(isAnonymousProvider);
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;
    final playerCount = widget.game.participants.length;

    // Resolve participant Player from the cached provider.
    final avatars = <AvatarEntry>[];
    for (final p in widget.game.participants) {
      final playerId = p.userId ?? p.botId;
      if (playerId == null) continue;
      final info = ref.watch(playerInfoCacheProvider(id: playerId));
      if (info.value case final value?) {
        avatars.add((
          avatarUrl: value.avatarUrl,
          isBot: p.type == SeatTypeEnum.bot,
        ));
      }
    }

    final openGame = canNavigate
        ? () => context.pushNamed(
            'game',
            pathParameters: {'gameId': widget.game.id},
          )
        : null;
    final leading = avatars.isNotEmpty
        ? OverlappingAvatars(players: avatars, radius: 18)
        : CircleAvatar(
            backgroundColor: isOwner
                ? colorScheme.secondaryContainer
                : colorScheme.primaryContainer,
            child: Icon(
              gameTimingIcon(widget.game),
              color: isOwner
                  ? colorScheme.onSecondaryContainer
                  : colorScheme.onPrimaryContainer,
            ),
          );
    final title = Text(
      isOwner ? 'Your Room' : 'Game #${widget.game.id.substring(0, 8)}',
      style: textTheme.titleMedium,
    );
    final details = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '${gameTimingLabel(widget.game)} • ${widget.game.access.name}',
          style: textTheme.bodySmall,
        ),
        const SizedBox(height: 4),
        _PlayerSlots(
          playerCount: playerCount,
          minPlayers: widget.game.minPlayers,
          maxPlayers: widget.game.maxPlayers,
          waitLabel: formatWaitDuration(widget.game.createdAt),
          colorScheme: colorScheme,
          textTheme: textTheme,
        ),
      ],
    );
    final action = _isLoading
        ? const SizedBox(
            width: 40,
            height: 40,
            child: Center(
              child: SizedBox.square(
                dimension: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          )
        : isOwner
        ? OutlinedButton(
            onPressed: _cancelGame,
            style: OutlinedButton.styleFrom(
              foregroundColor: colorScheme.error,
              side: BorderSide(color: colorScheme.error),
            ),
            child: const Text('Cancel'),
          )
        : isParticipant
        ? OutlinedButton(onPressed: openGame, child: const Text('View'))
        : !supported
        ? const FilledButton(onPressed: null, child: Text('Update to join'))
        : ratedBlockedForGuest
        ? const FilledButton(
            onPressed: null,
            child: Text('Sign up to play rated'),
          )
        : FilledButton(onPressed: _joinGame, child: const Text('Join'));

    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: LayoutBuilder(
        builder: (context, constraints) {
          if (constraints.maxWidth >= 480) {
            return ListTile(
              onTap: openGame,
              leading: leading,
              title: title,
              subtitle: details,
              isThreeLine: true,
              trailing: action,
            );
          }
          return InkWell(
            onTap: openGame,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      leading,
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [title, const SizedBox(height: 4), details],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Align(alignment: Alignment.centerRight, child: action),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _joinGame() async {
    setState(() => _isLoading = true);
    try {
      await ref
          .read(gameRepositoryProvider)
          .joinGame(
            widget.game.id,
            clientSchemaVersions: ref
                .read(currentGameModuleProvider)
                .supportedSchemaVersions,
          );
      if (!mounted) return;
      setState(() => _isLoading = false);
      await context.pushNamed(
        'game',
        pathParameters: {'gameId': widget.game.id},
      );
      if (mounted) widget.onJoined();
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(humanize(e))));
    }
  }

  Future<void> _cancelGame() async {
    setState(() => _isLoading = true);
    try {
      await ref.read(gameRepositoryProvider).cancelGame(widget.game.id);
      if (!mounted) return;
      setState(() => _isLoading = false);
      widget.onCancelled();
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(humanize(e))));
    }
  }
}

/// Row of filled/empty pip dots representing player slots, plus a wait label.
class _PlayerSlots extends StatelessWidget {
  const _PlayerSlots({
    required this.playerCount,
    required this.minPlayers,
    required this.maxPlayers,
    required this.waitLabel,
    required this.colorScheme,
    required this.textTheme,
  });

  final int playerCount;
  final int minPlayers;
  final int maxPlayers;
  final String waitLabel;
  final ColorScheme colorScheme;
  final TextTheme textTheme;

  @override
  Widget build(BuildContext context) {
    // Once playerCount >= minPlayers the game is ready: all pips are filled and
    // the fraction switches to playerCount/maxPlayers to show remaining capacity.
    // Below the threshold the fraction shows progress toward the minimum, with
    // the max appended only when the two values differ.
    final isReady = playerCount >= minPlayers;
    final fraction = isReady
        ? '$playerCount/$maxPlayers'
        : '$playerCount/$minPlayers';
    final capacitySuffix = !isReady && maxPlayers > minPlayers
        ? ' • $maxPlayers max'
        : '';
    return Wrap(
      spacing: 4,
      runSpacing: 2,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (int i = 0; i < minPlayers; i++)
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(right: 4),
                decoration: BoxDecoration(
                  color: i < playerCount
                      ? colorScheme.primary
                      : colorScheme.outlineVariant,
                  shape: BoxShape.circle,
                ),
              ),
          ],
        ),
        Text(
          '$fraction$capacitySuffix • $waitLabel',
          style: textTheme.bodySmall?.copyWith(
            color: colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}
