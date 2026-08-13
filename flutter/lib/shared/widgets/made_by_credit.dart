import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/link.dart';

import '../../core/config/app_config.dart';

/// The linked span inside the default credit, and where it goes. Kept in step
/// with the engine's `CREDIT_BRAND`/`CREDIT_URL`, so the app and the game's own
/// website end on the same line rendered the same way.
const _creditBrand = 'EigenInteractive';
final _creditUrl = Uri.parse('https://eigeninteractive.com');

/// The credit line at the foot of the settings and about screens.
///
/// Only the brand name inside the line is linked. It is underlined as well as
/// coloured so the affordance does not depend on colour perception, and the
/// Material text button supplies keyboard focus and hover feedback. A custom
/// [Branding.madeByCredit] that never mentions the engine renders as plain text,
/// so an app that replaced the line does not silently link its own words to us.
class MadeByCredit extends ConsumerWidget {
  const MadeByCredit({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final credit = ref.watch(appConfigProvider).branding.madeByCredit;
    final style = theme.textTheme.bodySmall?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
    );
    final at = credit.indexOf(_creditBrand);
    // The default line ends on the brand, so the trailing part is usually
    // empty. Both are dropped when empty rather than shipping spans with
    // nothing in them.
    final before = at == -1 ? '' : credit.substring(0, at);
    final after = at == -1 ? '' : credit.substring(at + _creditBrand.length);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: at == -1
          ? Text(credit, style: style, textAlign: TextAlign.center)
          : Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (before.isNotEmpty) Text(before, style: style),
                Link(
                  uri: _creditUrl,
                  target: LinkTarget.blank,
                  builder: (context, followLink) => Semantics(
                    link: true,
                    linkUrl: _creditUrl,
                    label: _creditBrand,
                    enabled: followLink != null,
                    focusable: followLink != null,
                    onTap: followLink,
                    excludeSemantics: true,
                    child: TextButton(
                      onPressed: followLink,
                      style: TextButton.styleFrom(
                        foregroundColor: theme.colorScheme.primary,
                        minimumSize: const Size(48, 48),
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                      ),
                      child: Text(
                        _creditBrand,
                        style: style?.copyWith(
                          color: theme.colorScheme.primary,
                          decoration: TextDecoration.underline,
                          decorationColor: theme.colorScheme.primary,
                        ),
                      ),
                    ),
                  ),
                ),
                if (after.isNotEmpty) Text(after, style: style),
              ],
            ),
    );
  }
}
