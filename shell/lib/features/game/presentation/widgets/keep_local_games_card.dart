import 'package:eigen_flutter/shell_support.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Offers to have the browser keep the games this device is holding.
///
/// A browser may clear a site's storage when it runs short of space, and a game
/// played here that has not uploaded yet is the one thing a sync cannot bring
/// back. Asking the browser to keep it makes some browsers ask the player, so
/// this explains what it is for first, and appears only while such a game
/// exists and the browser has neither granted nor refused. It shows nothing on
/// a device, which evicts nothing.
class KeepLocalGamesCard extends ConsumerStatefulWidget {
  const KeepLocalGamesCard({super.key});

  @override
  ConsumerState<KeepLocalGamesCard> createState() => _KeepLocalGamesCardState();
}

class _KeepLocalGamesCardState extends ConsumerState<KeepLocalGamesCard> {
  bool _asking = false;

  @override
  Widget build(BuildContext context) {
    final offer = ref.watch(keepLocalGamesProvider).value ?? false;
    if (!offer) return const SizedBox.shrink();

    final textTheme = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.save_outlined),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Keep your offline games',
                        style: textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'A game you play offline is only on this device until '
                        'it uploads, and a browser short of space may clear it. '
                        'Your browser may ask you to allow this.',
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: _asking ? null : _dismiss,
                  child: const Text('Not now'),
                ),
                const SizedBox(width: 8),
                FilledButton.tonalIcon(
                  onPressed: _asking ? null : _keep,
                  icon: _asking
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.shield_outlined),
                  label: const Text('Keep them'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _keep() async {
    setState(() => _asking = true);
    try {
      final decision = await ref.read(keepLocalGamesProvider.notifier).keep();
      if (!mounted) return;
      if (decision != StoragePersistence.granted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              "Your browser didn't allow it. Games still save here, but it may "
              'clear them if it runs short of space before they upload.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _asking = false);
    }
  }

  Future<void> _dismiss() =>
      ref.read(keepLocalGamesProvider.notifier).dismiss();
}
