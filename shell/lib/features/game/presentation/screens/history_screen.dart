import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_client/eigen_client.dart';

import 'package:eigen_shell/features/game/presentation/extensions/game_ui.dart';
import 'package:eigen_shell/features/rating/presentation/extensions/rating_ui.dart';

/// How many more games each step of scrolling asks the replica for.
const _pageSize = 30;

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
///
/// Read from the replica (decision 0013), so it opens instantly and offline,
/// with games played online and on this device in one list. Scrolling asks the
/// replica for more; only when it has shown everything the device holds, and
/// the server has older history, does it fetch the next page, which lands in
/// the replica and appears here.
class HistoryScreen extends ConsumerStatefulWidget {
  const HistoryScreen({super.key});

  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen> {
  int _limit = _pageSize;
  bool _fetchingOlder = false;

  /// The list length the last request for more was made at. The near-end
  /// callback fires for several cards in one frame, and again on every rebuild
  /// until the list grows, so one length asks once.
  int? _askedAt;

  Future<void> _refresh() async {
    await ref.read(syncCoordinatorProvider.notifier).run();
  }

  /// Shows more of what the replica holds, and fetches older history once the
  /// replica holds no more to show.
  Future<void> _showMore({required int shown}) async {
    if (_askedAt == shown) return;
    _askedAt = shown;
    if (shown >= _limit) {
      setState(() => _limit += _pageSize);
      return;
    }
    if (ref.read(accountHistoryProvider).value?.hasOlder != true) return;
    setState(() => _fetchingOlder = true);
    try {
      await ref.read(syncCoordinatorProvider.notifier).loadOlderHistory();
      // The page lands in the replica and the list grows past [shown], which
      // asks again by itself. Clearing this covers a page that added nothing.
      _askedAt = null;
    } on Object catch (error) {
      // Left set, so a failure is not retried on every frame. Pulling to
      // refresh or scrolling again after the list changes asks anew.
      if (mounted) {
        ScaffoldMessenger.of(context)
          ..clearSnackBars()
          ..showSnackBar(SnackBar(content: Text(humanize(error))));
      }
    } finally {
      if (mounted) setState(() => _fetchingOlder = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final gamesAsync = ref.watch(finishedGamesProvider(limit: _limit));
    final myUserId = ref.watch(currentUserIdProvider);

    return AdaptiveLayoutBuilder(
      builder: (context, constraints, windowClass) => Column(
        children: [
          Align(
            alignment: Alignment.centerRight,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: IconButton(
                onPressed: () => unawaited(_refresh()),
                icon: const Icon(Icons.refresh),
                tooltip: 'Refresh history',
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refresh,
              child: switch (gamesAsync) {
                AsyncData(:final value) when value.isEmpty => CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  slivers: [
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: EmptyStateView(
                        icon: Icons.history,
                        title: 'No finished games yet',
                        message: 'Completed games will appear here.',
                        cta: 'Play your first game',
                        onCta: () => context.go('/lobby'),
                        tonalCta: true,
                      ),
                    ),
                  ],
                ),
                AsyncValue(:final value?) => _HistoryList(
                  entries: [
                    for (final game in value)
                      (
                        game: game,
                        myResult: _myResult(game, myUserId),
                        ratingChange: _myRatingChange(game, myUserId),
                      ),
                  ],
                  useGrid: shouldUseCardGrid(
                    windowClass: windowClass,
                    textScaler: MediaQuery.textScalerOf(context),
                  ),
                  availableWidth: constraints.maxWidth,
                  fetchingOlder: _fetchingOlder,
                  onNearEnd: () => unawaited(_showMore(shown: value.length)),
                ),
                AsyncError(:final error) => Center(
                  child: Text(humanize(error)),
                ),
                _ => const Center(child: CircularProgressIndicator()),
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryList extends StatelessWidget {
  const _HistoryList({
    required this.entries,
    required this.useGrid,
    required this.availableWidth,
    required this.fetchingOlder,
    required this.onNearEnd,
  });

  final List<_HistoryEntry> entries;
  final bool useGrid;
  final double availableWidth;
  final bool fetchingOlder;
  final VoidCallback onNearEnd;

  Widget _item(BuildContext context, int index) {
    // Asking for more as the last few cards come into view keeps scrolling
    // continuous; the callback is idempotent while a fetch is in flight.
    if (index >= entries.length - 5) {
      WidgetsBinding.instance.addPostFrameCallback((_) => onNearEnd());
    }
    return _HistoryCard(
      key: ValueKey(entries[index].game.id),
      entry: entries[index],
    );
  }

  @override
  Widget build(BuildContext context) {
    final footer = fetchingOlder
        ? const Padding(
            padding: EdgeInsets.all(16),
            child: Center(child: CircularProgressIndicator()),
          )
        : const SizedBox(height: 16);
    if (!useGrid) {
      return ConstrainedContentPane(
        maxWidth: 720,
        child: ListView.separated(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          itemCount: entries.length + 1,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (context, index) =>
              index == entries.length ? footer : _item(context, index),
        ),
      );
    }
    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          sliver: SliverGrid.builder(
            gridDelegate: responsiveCardGridDelegate(
              availableWidth: availableWidth - 32,
              maxCrossAxisExtent: 560,
              mainAxisExtent: 110,
            ),
            itemCount: entries.length,
            itemBuilder: _item,
          ),
        ),
        SliverToBoxAdapter(child: footer),
      ],
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
