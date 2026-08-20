import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:infinite_scroll_pagination/infinite_scroll_pagination.dart';
import 'package:intl/intl.dart';
import 'package:eigen_flutter/core/errors/error_messages.dart';
import 'package:eigen_flutter/core/adaptive/adaptive_layout.dart';
import 'package:eigen_flutter/core/theme/app_semantic_colors.dart';
import 'package:eigen_client/eigen_client.dart';

import 'package:eigen_flutter/features/game/presentation/extensions/game_ui.dart';
import 'package:eigen_flutter/features/rating/presentation/extensions/rating_ui.dart';
import 'package:eigen_flutter/features/game/providers/game_providers.dart';
import 'package:eigen_flutter/shared/widgets/empty_state_view.dart';
import 'package:eigen_flutter/features/auth/providers/auth_providers.dart';

typedef _HistoryEntry = ({
  GameSummary game,
  OutcomeResultEnum? myResult,
  RatingDelta? ratingChange,
});

/// The caller's own rating change for a game, or null when it was unrated.
///
/// The summary carries every seat's delta, so this picks out the caller's the
/// same way [_myResult] picks out their outcome.
RatingDelta? _myRatingChange(GameSummary game, String? myUserId) {
  if (myUserId == null) return null;
  return game.ratings?.where((r) => r.identity.userId == myUserId).firstOrNull;
}

/// The caller's own result in a finished game, or null when there is none:
/// an aborted game writes no outcomes.
OutcomeResultEnum? _myResult(GameSummary game, String? myUserId) {
  final seat = game.participants
      .where((p) => p.userId == myUserId)
      .map((p) => p.playerIndex)
      .firstOrNull;
  if (seat == null) return null;
  return game.outcomes
      ?.where((o) => o.playerIndex == seat)
      .map((o) => o.result)
      .firstOrNull;
}

/// Screen showing the current user's completed game history.
class HistoryScreen extends ConsumerStatefulWidget {
  const HistoryScreen({super.key});

  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen> {
  late final PagingController<String, _HistoryEntry> _pagingController;

  /// The cursor for the page after the one most recently fetched, or null once
  /// the server has said the list is exhausted. The empty string is "no cursor
  /// yet", i.e. the first page; it cannot be null, because null is how this
  /// controller is told there are no more pages.
  String? _nextKey = '';

  /// Reload from the top.
  ///
  /// The cursor lives beside the controller rather than inside it, so the two
  /// have to be reset together - refreshing the list without clearing the
  /// cursor would refetch page one and then continue from wherever the last
  /// scroll had reached. There are three refresh affordances on this screen
  /// (the toolbar button, pull-to-refresh, and the error retry), which is
  /// exactly why this is a method and not three copies of two lines.
  void _refresh() {
    _nextKey = '';
    _pagingController.refresh();
  }

  @override
  void initState() {
    super.initState();
    _pagingController = PagingController<String, _HistoryEntry>(
      getNextPageKey: (state) => _nextKey,
      fetchPage: (key) async {
        final page = await ref
            .read(gameRepositoryProvider)
            .getMyGames(
              bucket: finishedGamesBucket,
              cursor: key.isEmpty ? null : key,
            );
        // The server says where the next page starts, and says so with a token
        // this screen never opens. Nothing here knows that finished games sort
        // by their finish time; that is the server's rule to keep.
        _nextKey = page.nextCursor;
        final games = page.games;
        // The summary carries the roster, the outcomes and the rating deltas,
        // so every field of a row is derived from the one response. Joining a
        // separate rating log here would have been a second round trip per
        // page - and silently wrong past its own page limit.
        final myUserId = ref.read(currentUserIdProvider);
        return [
          for (final game in games)
            (
              game: game,
              myResult: _myResult(game, myUserId),
              ratingChange: _myRatingChange(game, myUserId),
            ),
        ];
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
                tooltip: 'Refresh history',
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
                      PagedChildBuilderDelegate<_HistoryEntry>(
                        animateTransitions: true,
                        itemBuilder: (context, entry, _) => _HistoryCard(
                          key: ValueKey(entry.game.id),
                          entry: entry,
                        ),
                        noItemsFoundIndicatorBuilder: (_) => EmptyStateView(
                          icon: Icons.history,
                          title: 'No finished games yet',
                          message: 'Completed games will appear here.',
                          cta: 'Play your first game',
                          onCta: () => context.go('/lobby'),
                          tonalCta: true,
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
                      child: PagedListView<String, _HistoryEntry>.separated(
                        state: state,
                        fetchNextPage: fetchNextPage,
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                        separatorBuilder: (_, _) => const SizedBox(height: 12),
                        builderDelegate: builderDelegate,
                      ),
                    );
                  }
                  return PagedGridView<String, _HistoryEntry>(
                    state: state,
                    fetchNextPage: fetchNextPage,
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                    gridDelegate: responsiveCardGridDelegate(
                      availableWidth: constraints.maxWidth - 32,
                      maxCrossAxisExtent: 560,
                      mainAxisExtent: 110,
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

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({super.key, required this.entry});

  final _HistoryEntry entry;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final semanticColors = AppSemanticColors.of(context);
    final textTheme = Theme.of(context).textTheme;
    final game = entry.game;
    final result = entry.myResult;
    final ratingChange = entry.ratingChange;

    final locale = Localizations.localeOf(context).toString();
    final date = DateTime.fromMillisecondsSinceEpoch(
      game.finishedAt ?? game.updatedAt,
    );
    final dateLabel = DateFormat.yMMMd(locale).format(date.toLocal());

    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () =>
            context.pushNamed('game', pathParameters: {'gameId': game.id}),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: result.containerColor(
                    colorScheme,
                    semanticColors: semanticColors,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  result.icon,
                  color: result.onContainerColor(
                    colorScheme,
                    semanticColors: semanticColors,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Game #${game.id.substring(0, 8)}',
                      style: textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${result.label} • $dateLabel',
                      style: textTheme.bodySmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                    if (ratingChange != null) ...[
                      const SizedBox(height: 6),
                      _RatingDelta(change: ratingChange),
                    ],
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: colorScheme.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}

class _RatingDelta extends StatelessWidget {
  const _RatingDelta({required this.change});

  final RatingDelta change;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;
    final poolName = change.pool[0].toUpperCase() + change.pool.substring(1);

    final color = change.color(
      colorScheme,
      semanticColors: AppSemanticColors.of(context),
    );
    final String triangle;
    final String amount;
    if (change.displayChange > 0) {
      triangle = '▲';
      amount = '+${change.displayChange}';
    } else if (change.displayChange < 0) {
      triangle = '▼';
      amount = '${change.displayChange}';
    } else {
      triangle = '–';
      amount = '0';
    }

    return Text(
      '$triangle $amount $poolName',
      style: textTheme.bodySmall?.copyWith(
        color: color,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}
