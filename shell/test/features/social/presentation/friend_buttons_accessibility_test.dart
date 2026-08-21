import 'package:eigen_shell/features/social/presentation/widgets/friend_buttons.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('compact friend actions are labelled Material tap targets', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();

    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: Wrap(
              children: [
                AcceptRequestButton(playerId: 'accept', compact: true),
                DeclineRequestButton(playerId: 'decline', compact: true),
                RemoveFriendButton(playerId: 'remove', compact: true),
              ],
            ),
          ),
        ),
      ),
    );

    expect(find.byTooltip('Accept friend request'), findsOneWidget);
    expect(find.byTooltip('Decline friend request'), findsOneWidget);
    expect(find.byTooltip('Remove friend'), findsOneWidget);
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    semantics.dispose();
  });
}
