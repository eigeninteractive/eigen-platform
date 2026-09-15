import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/shell_support.dart';
import 'package:eigen_shell/features/store/providers/store_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Reports a failed action, offering the store when a purchase would fix it.
///
/// The offer is made from the server's stable error code and nothing else. A
/// refusal a purchase cannot lift — a pending purchase, a rate limit, a bug —
/// gets the message alone, because inviting someone to pay for something
/// buying cannot resolve reads as being charged for a defect.
///
/// The action is also withheld when this build sells nothing, so a game with
/// no storefront never advertises one.
void showRefusal(BuildContext context, WidgetRef ref, Object error) {
  final code = error is EngineException ? error.code : null;
  final upgradeable =
      isUpgradeableRefusal(code) && ref.read(storeAvailableProvider);
  // Resolved now rather than on tap. The snack bar outlives whatever showed it
  // -- a picker the player closes, a join screen that has already gone home --
  // and a late tap would otherwise look the router up from an unmounted context.
  final router = GoRouter.maybeOf(context);
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(humanize(error)),
      action: upgradeable
          ? SnackBarAction(
              label: 'See options',
              onPressed: () =>
                  (router ?? GoRouter.of(context)).goNamed('store'),
            )
          : null,
    ),
  );
}
