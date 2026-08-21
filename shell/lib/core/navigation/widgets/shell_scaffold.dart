import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/core/updates/update_notifier.dart';
import 'package:eigen_shell/features/auth/providers/auth_controller.dart';
import 'package:eigen_shell/features/game/presentation/widgets/new_game_dialog.dart';
import 'package:eigen_shell/features/game/presentation/widgets/play_vs_bot_dialog.dart';
import 'package:eigen_shell/features/social/providers/social_providers.dart';

enum _ShellBranch {
  home(''),
  lobby('Game Lobby'),
  history('History'),
  social('Social'),
  about('About'),
  settings('Settings');

  const _ShellBranch(this.title);

  final String title;
}

/// Shell scaffold that wraps all routes with persistent navigation.
class ShellScaffold extends ConsumerWidget {
  const ShellScaffold({required this.navigationShell, super.key});

  /// The navigation shell and container for the branch Navigators.
  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(updateProvider, (_, next) {
      if (next == UpdateInstallStatus.downloadComplete) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('A new version is ready.'),
            duration: const Duration(seconds: 10),
            action: SnackBarAction(
              label: 'Restart',
              onPressed: () =>
                  ref.read(updateProvider.notifier).completeUpdate(),
            ),
          ),
        );
      }
    });
    final isOffline = ref.watch(isOfflineProvider);
    final isGuest = ref.watch(isAnonymousProvider);
    // Offer solo play only when a playable combination exists; an untimed mode
    // with a usable local bot, or a timed mode with a usable server bot (so the
    // name is "solo", not "local bots": both classes can fill the seats). See
    // [soloPlayAvailableProvider]. Most deployments with no bots get an empty
    // catalog → no extra FAB.
    final canPlaySolo = ref.watch(soloPlayAvailableProvider);
    final index = navigationShell.currentIndex;
    final branch = _ShellBranch.values[index];
    final title = branch.title;

    void selectBranch(int i) {
      navigationShell.goBranch(i, initialLocation: i == index);
    }

    void showNewGame() => showDialog<void>(
      context: context,
      useSafeArea: true,
      builder: (_) => const NewGameDialog(),
    );

    return AdaptiveLayoutBuilder(
      builder: (context, constraints, windowClass) {
        final compact = windowClass.isCompact;
        final expandedRail = windowClass.isAtLeastExpanded;
        final content = Column(
          children: [
            AnimatedSize(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeInOut,
              child: isOffline
                  ? const _OfflineBanner()
                  : const SizedBox.shrink(),
            ),
            Expanded(child: SafeArea(child: navigationShell)),
          ],
        );

        return Scaffold(
          appBar: AppBar(
            automaticallyImplyLeading: compact,
            title: title.isEmpty ? null : Text(title),
            actions: index == 0 && canPlaySolo
                ? [
                    IconButton(
                      onPressed: () => showDialog<void>(
                        context: context,
                        useSafeArea: true,
                        builder: (_) => const PlayVsBotDialog(),
                      ),
                      icon: const Icon(Icons.smart_toy_outlined),
                      tooltip: 'New Solo Game',
                    ),
                  ]
                : null,
          ),
          drawer: compact
              ? NavigationDrawer(
                  selectedIndex: index,
                  onDestinationSelected: (int i) {
                    Navigator.of(context).pop();
                    selectBranch(i);
                  },
                  children: [
                    const _DrawerHeader(),
                    ..._drawerDestinations(isGuest: isGuest),
                    const _SignOutButton(),
                  ],
                )
              : null,
          floatingActionButton: index == 0
              ? FloatingActionButton.extended(
                  heroTag: 'newGame',
                  onPressed: showNewGame,
                  icon: const Icon(Icons.add),
                  label: const Text('New Game'),
                )
              : null,
          body: compact
              ? content
              : Row(
                  children: [
                    SafeArea(
                      right: false,
                      child: NavigationRail(
                        extended: expandedRail,
                        selectedIndex: index,
                        onDestinationSelected: selectBranch,
                        labelType: expandedRail
                            ? NavigationRailLabelType.none
                            : NavigationRailLabelType.all,
                        groupAlignment: -1,
                        scrollable: true,
                        leadingAtTop: false,
                        leading: expandedRail
                            ? const _RailHeader()
                            : const SizedBox(height: 16),
                        trailing: const _RailSignOutButton(),
                        trailingAtBottom: true,
                        destinations: _railDestinations(isGuest: isGuest),
                      ),
                    ),
                    const VerticalDivider(width: 1),
                    Expanded(child: content),
                  ],
                ),
        );
      },
    );
  }
}

List<NavigationDrawerDestination> _drawerDestinations({
  required bool isGuest,
}) => [
  const NavigationDrawerDestination(
    icon: Icon(Icons.home_outlined),
    selectedIcon: Icon(Icons.home_rounded),
    label: Text('Home'),
  ),
  const NavigationDrawerDestination(
    icon: Icon(Icons.groups_outlined),
    selectedIcon: Icon(Icons.groups_rounded),
    label: Text('Lobby'),
  ),
  const NavigationDrawerDestination(
    icon: Icon(Icons.history_outlined),
    selectedIcon: Icon(Icons.history_rounded),
    label: Text('History'),
  ),
  NavigationDrawerDestination(
    enabled: !isGuest,
    icon: const _SocialDrawerIcon(selected: false),
    selectedIcon: const _SocialDrawerIcon(selected: true),
    label: const Text('Social'),
  ),
  const NavigationDrawerDestination(
    icon: Icon(Icons.info_outline),
    selectedIcon: Icon(Icons.info_rounded),
    label: Text('About'),
  ),
  const NavigationDrawerDestination(
    icon: Icon(Icons.settings_outlined),
    selectedIcon: Icon(Icons.settings_rounded),
    label: Text('Settings'),
  ),
];

List<NavigationRailDestination> _railDestinations({required bool isGuest}) => [
  const NavigationRailDestination(
    icon: Icon(Icons.home_outlined),
    selectedIcon: Icon(Icons.home_rounded),
    label: Text('Home'),
  ),
  const NavigationRailDestination(
    icon: Icon(Icons.groups_outlined),
    selectedIcon: Icon(Icons.groups_rounded),
    label: Text('Lobby'),
  ),
  const NavigationRailDestination(
    icon: Icon(Icons.history_outlined),
    selectedIcon: Icon(Icons.history_rounded),
    label: Text('History'),
  ),
  NavigationRailDestination(
    disabled: isGuest,
    icon: const _SocialDrawerIcon(selected: false),
    selectedIcon: const _SocialDrawerIcon(selected: true),
    label: const Text('Social'),
  ),
  const NavigationRailDestination(
    icon: Icon(Icons.info_outline),
    selectedIcon: Icon(Icons.info_rounded),
    label: Text('About'),
  ),
  const NavigationRailDestination(
    icon: Icon(Icons.settings_outlined),
    selectedIcon: Icon(Icons.settings_rounded),
    label: Text('Settings'),
  ),
];

/// Slim banner shown when the device has no network connectivity.
class _OfflineBanner extends StatelessWidget {
  const _OfflineBanner();

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return StatusBanner(
      leading: Icon(
        Icons.wifi_off_rounded,
        size: 16,
        color: colorScheme.onErrorContainer,
      ),
      label: 'No internet connection',
      backgroundColor: colorScheme.errorContainer,
      foregroundColor: colorScheme.onErrorContainer,
    );
  }
}

/// Drawer header widget.
class _DrawerHeader extends ConsumerWidget {
  const _DrawerHeader();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 32),
      alignment: Alignment.center,
      child: Text(
        ref.watch(appConfigProvider).branding.appName,
        style: Theme.of(context).textTheme.titleLarge,
      ),
    );
  }
}

class _RailHeader extends ConsumerWidget {
  const _RailHeader();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
      child: Text(
        ref.watch(appConfigProvider).branding.appName,
        style: Theme.of(context).textTheme.titleMedium,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

/// Social icon with a badge showing the number of incoming friend requests.
class _SocialDrawerIcon extends ConsumerWidget {
  const _SocialDrawerIcon({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = switch (ref.watch(incomingRequestsProvider)) {
      AsyncData(:final value) => value.length,
      _ => 0,
    };
    final icon = Icon(selected ? Icons.people_rounded : Icons.people_outline);
    if (count > 0) {
      return Badge.count(count: count, child: icon);
    }
    return icon;
  }
}

/// Sign out button widget.
class _SignOutButton extends ConsumerWidget {
  const _SignOutButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 48),
      child: OutlinedButton.icon(
        onPressed: () async {
          Scaffold.of(context).closeDrawer();
          await ref.read(authControllerProvider.notifier).signOut();
        },
        icon: const Icon(Icons.logout),
        label: const Text('Sign Out'),
      ),
    );
  }
}

class _RailSignOutButton extends ConsumerWidget {
  const _RailSignOutButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: IconButton(
        onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
        icon: const Icon(Icons.logout),
        tooltip: 'Sign Out',
      ),
    );
  }
}
