import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:eigen_flutter/core/errors/error_messages.dart';
import 'package:eigen_flutter/core/adaptive/adaptive_layout.dart';
import 'package:eigen_flutter/features/social/presentation/widgets/friend_actions.dart';
import 'package:eigen_flutter/features/social/presentation/widgets/friend_buttons.dart';
import 'package:eigen_flutter/features/social/presentation/widgets/player_profile_sheet.dart';
import 'package:eigen_flutter/features/social/providers/social_providers.dart';
import 'package:eigen_api/eigen_api.dart';
import 'package:eigen_flutter/shared/widgets/empty_state_view.dart';
import 'package:eigen_flutter/shared/widgets/player_avatar.dart';

class SocialScreen extends ConsumerStatefulWidget {
  const SocialScreen({super.key});

  @override
  ConsumerState<SocialScreen> createState() => _SocialScreenState();
}

class _SocialScreenState extends ConsumerState<SocialScreen>
    with SingleTickerProviderStateMixin {
  static const _tabNames = ['friends', 'requests', 'add'];

  late TabController _tabController;
  String? _selectedPlayerId;
  bool _syncingFromRoute = false;
  int? _directTabSelection;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(_handleControllerChange);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final routeIndex = _routeTabIndex();
    if (_tabController.index == routeIndex) return;

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

  void _selectTabFromUser(int index, {bool animate = false}) {
    if (index == _routeTabIndex()) {
      _directTabSelection = null;
      return;
    }
    _directTabSelection = index;
    if (animate && _tabController.index != index) {
      _tabController.animateTo(index);
    }
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
    Router.neglect(context, () => context.go(_locationForTab(index)));
  }

  void _goToAddFriend() => _selectTabFromUser(2, animate: true);

  @override
  Widget build(BuildContext context) {
    final requestCount = switch (ref.watch(incomingRequestsProvider)) {
      AsyncData(:final value) => value.length,
      _ => 0,
    };

    return AdaptiveLayoutBuilder(
      builder: (context, constraints, windowClass) {
        final expanded = windowClass.isAtLeastExpanded;
        const expandedMasterPaneWidth = 440.0;
        final tabBarWidth = expanded
            ? expandedMasterPaneWidth
            : constraints.maxWidth;
        final scrollableTabs = tabBarWidth < 520;
        final tabs = Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: TabBar(
                    controller: _tabController,
                    onTap: _selectTabFromUser,
                    isScrollable: scrollableTabs,
                    tabAlignment: scrollableTabs
                        ? TabAlignment.start
                        : TabAlignment.fill,
                    tabs: [
                      const Tab(text: 'Friends'),
                      Tab(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text('Requests'),
                            if (requestCount > 0) ...[
                              const SizedBox(width: 6),
                              Badge.count(count: requestCount, smallSize: 14),
                            ],
                          ],
                        ),
                      ),
                      const Tab(text: 'Add Friend'),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () {
                    ref
                      ..invalidate(friendsProvider)
                      ..invalidate(friendRequestsProvider);
                  },
                  icon: const Icon(Icons.refresh),
                  tooltip: 'Refresh social lists',
                ),
                const SizedBox(width: 8),
              ],
            ),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  _FriendsList(
                    onFindPlayers: _goToAddFriend,
                    selectedPlayerId: expanded ? _selectedPlayerId : null,
                    onPlayerSelected: expanded
                        ? (id) => setState(() => _selectedPlayerId = id)
                        : null,
                  ),
                  _PendingRequests(
                    selectedPlayerId: expanded ? _selectedPlayerId : null,
                    onPlayerSelected: expanded
                        ? (id) => setState(() => _selectedPlayerId = id)
                        : null,
                  ),
                  _AddFriend(
                    selectedPlayerId: expanded ? _selectedPlayerId : null,
                    onPlayerSelected: expanded
                        ? (id) => setState(() => _selectedPlayerId = id)
                        : null,
                  ),
                ],
              ),
            ),
          ],
        );

        if (!expanded) {
          return ConstrainedContentPane(maxWidth: 720, child: tabs);
        }
        return Row(
          children: [
            SizedBox(width: expandedMasterPaneWidth, child: tabs),
            const VerticalDivider(width: 1),
            Expanded(
              child: _selectedPlayerId == null
                  ? const EmptyStateView(
                      icon: Icons.person_search_outlined,
                      title: 'Select a player',
                      message:
                          'Choose someone to view their profile and ratings.',
                    )
                  : PlayerProfilePanel(
                      playerId: _selectedPlayerId!,
                      type: SeatTypeEnum.human,
                    ),
            ),
          ],
        );
      },
    );
  }
}

// ── Friends list ──────────────────────────────────────────────────────────────

class _FriendsList extends ConsumerStatefulWidget {
  const _FriendsList({
    required this.onFindPlayers,
    required this.selectedPlayerId,
    required this.onPlayerSelected,
  });

  final VoidCallback onFindPlayers;
  final String? selectedPlayerId;
  final ValueChanged<String>? onPlayerSelected;

  @override
  ConsumerState<_FriendsList> createState() => _FriendsListState();
}

class _FriendsListState extends ConsumerState<_FriendsList>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final friendsAsync = ref.watch(friendsProvider);

    return friendsAsync.when(
      skipLoadingOnReload: true,
      data: (friendships) => RefreshIndicator(
        onRefresh: () async => ref.invalidate(friendsProvider),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            if (friendships.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: EmptyStateView(
                  icon: Icons.people_outline,
                  title: 'No friends yet',
                  message:
                      'Add friends to stay connected and join their games.',
                  cta: 'Find Players',
                  onCta: widget.onFindPlayers,
                  tonalCta: true,
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.only(top: 8),
                sliver: SliverList.builder(
                  itemCount: friendships.length,
                  itemBuilder: (context, index) => _FriendListTile(
                    key: ValueKey(friendships[index].userId),
                    userId: friendships[index].userId,
                    displayName: friendships[index].displayName,
                    username: friendships[index].username,
                    avatarUrl: friendships[index].avatarUrl,
                    variant: _FriendListVariant.friends,
                    selected:
                        widget.selectedPlayerId == friendships[index].userId,
                    onPlayerSelected: widget.onPlayerSelected,
                  ),
                ),
              ),
          ],
        ),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: ${humanize(e)}')),
    );
  }
}

enum _FriendListVariant { friends, requests }

/// One friend or incoming request.
///
/// Takes the identity directly rather than resolving it from the player cache:
/// both the friends and the requests endpoint already embed the other user's
/// username, display name and avatar, so a per-row lookup would re-fetch what
/// the list response just delivered. That is also why this has no loading or
/// error state - there is nothing left to await.
class _FriendListTile extends StatelessWidget {
  const _FriendListTile({
    super.key,
    required this.userId,
    required this.displayName,
    required this.username,
    required this.avatarUrl,
    required this.variant,
    required this.selected,
    required this.onPlayerSelected,
  });

  final String userId;
  final String displayName;
  final String username;
  final String? avatarUrl;
  final _FriendListVariant variant;
  final bool selected;
  final ValueChanged<String>? onPlayerSelected;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      selected: selected,
      onTap: onPlayerSelected == null
          ? () => PlayerProfileSheet.show(
              context,
              playerId: userId,
              type: SeatTypeEnum.human,
            )
          : () => onPlayerSelected!(userId),
      leading: PlayerAvatar(avatarUrl: avatarUrl, radius: 20),
      title: Text(displayName),
      subtitle: Text(
        variant == _FriendListVariant.requests
            ? '@$username wants to be friends'
            : '@$username',
      ),
      trailing: switch (variant) {
        _FriendListVariant.friends => RemoveFriendButton(
          playerId: userId,
          compact: true,
        ),
        _FriendListVariant.requests => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            AcceptRequestButton(playerId: userId, compact: true),
            DeclineRequestButton(playerId: userId, compact: true),
          ],
        ),
      },
    );
  }
}

// ── Pending requests ──────────────────────────────────────────────────────────

class _PendingRequests extends ConsumerStatefulWidget {
  const _PendingRequests({
    required this.selectedPlayerId,
    required this.onPlayerSelected,
  });

  final String? selectedPlayerId;
  final ValueChanged<String>? onPlayerSelected;

  @override
  ConsumerState<_PendingRequests> createState() => _PendingRequestsState();
}

class _PendingRequestsState extends ConsumerState<_PendingRequests>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final requestsAsync = ref.watch(incomingRequestsProvider);

    return requestsAsync.when(
      skipLoadingOnReload: true,
      data: (requests) => RefreshIndicator(
        onRefresh: () async => ref.invalidate(friendRequestsProvider),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            if (requests.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: EmptyStateView(
                  icon: Icons.mail_outline,
                  title: 'No pending requests',
                  message: 'Friend requests you receive will appear here.',
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.only(top: 8),
                sliver: SliverList.builder(
                  itemCount: requests.length,
                  itemBuilder: (context, index) => _FriendListTile(
                    key: ValueKey(requests[index].userId),
                    userId: requests[index].userId,
                    displayName: requests[index].displayName,
                    username: requests[index].username,
                    avatarUrl: requests[index].avatarUrl,
                    variant: _FriendListVariant.requests,
                    selected: widget.selectedPlayerId == requests[index].userId,
                    onPlayerSelected: widget.onPlayerSelected,
                  ),
                ),
              ),
          ],
        ),
      ),
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: ${humanize(e)}')),
    );
  }
}

// ── Add friend ────────────────────────────────────────────────────────────────

class _AddFriend extends ConsumerStatefulWidget {
  const _AddFriend({
    required this.selectedPlayerId,
    required this.onPlayerSelected,
  });

  final String? selectedPlayerId;
  final ValueChanged<String>? onPlayerSelected;

  @override
  ConsumerState<_AddFriend> createState() => _AddFriendState();
}

class _AddFriendState extends ConsumerState<_AddFriend>
    with AutomaticKeepAliveClientMixin {
  final _searchController = TextEditingController();
  List<Player> _results = [];
  bool _isLoading = false;
  Timer? _debounce;

  @override
  bool get wantKeepAlive => true;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final query = _searchController.text.trim();
    if (query.length < 2) return;
    setState(() => _isLoading = true);
    try {
      final results = await ref
          .read(socialRepositoryProvider)
          .searchUsers(query);
      if (mounted) setState(() => _results = results);
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    if (value.trim().length >= 2) {
      _debounce = Timer(const Duration(milliseconds: 400), _search);
    } else if (_results.isNotEmpty) {
      setState(() => _results = []);
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: SearchBar(
            controller: _searchController,
            hintText: 'Search by username or display name',
            onChanged: _onSearchChanged,
            trailing: [
              IconButton(
                icon: const Icon(Icons.search),
                onPressed: _isLoading ? null : _search,
                tooltip: 'Search players',
              ),
            ],
            onSubmitted: (_) => _search(),
          ),
        ),
        if (_isLoading)
          const CircularProgressIndicator()
        else
          Expanded(
            child: ListView.builder(
              itemCount: _results.length,
              itemBuilder: (context, index) {
                final user = _results[index];
                return ListTile(
                  key: ValueKey(user.id),
                  selected: widget.selectedPlayerId == user.id,
                  onTap: widget.onPlayerSelected == null
                      ? () => PlayerProfileSheet.show(
                          context,
                          playerId: user.id,
                          type: SeatTypeEnum.human,
                        )
                      : () => widget.onPlayerSelected!(user.id),
                  leading: PlayerAvatar(avatarUrl: user.avatarUrl, radius: 20),
                  title: Text(user.displayName),
                  subtitle: Text('@${user.username}'),
                  trailing: FriendActions(playerId: user.id, compact: true),
                );
              },
            ),
          ),
      ],
    );
  }
}
