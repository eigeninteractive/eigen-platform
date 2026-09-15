import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_shell/features/store/providers/store_providers.dart';
import 'package:flutter_test/flutter_test.dart';

AccessSnapshot _access(List<AccessCapability> permissions) => AccessSnapshot(
  entitlements: const [],
  permissions: permissions,
  content: const [],
  limits: const [],
);

AccessCapability _botUse(String tier) =>
    AccessCapability(kind: AccessCapabilityKindEnum.botPeriodUse, tier: tier);

/// The presentation twin of the engine's `capabilityAllows` for `bot.use`. Each
/// case here is one the TypeScript rule decides the same way.
void main() {
  test('an unknown access is never a lock', () {
    expect(seatingLocked(null, 'standard'), isFalse);
  });

  test('a grant covers exactly the tier it names', () {
    final access = _access([_botUse('standard'), _botUse('gold')]);
    expect(seatingLocked(access, 'standard'), isFalse);
    expect(seatingLocked(access, 'gold'), isFalse);
    expect(seatingLocked(access, 'silver'), isTrue);
  });

  test('the default tier does not reach a paid one', () {
    expect(seatingLocked(_access([_botUse('standard')]), 'gold'), isTrue);
  });

  test('another capability is not a bot grant', () {
    final access = _access([
      AccessCapability(kind: AccessCapabilityKindEnum.replayPeriodRead),
    ]);
    expect(seatingLocked(access, 'standard'), isTrue);
  });
}
