import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_shell/features/store/providers/store_providers.dart';
import 'package:flutter_test/flutter_test.dart';

AccessSnapshot _access(List<AccessCapability> permissions) => AccessSnapshot(
  entitlements: const [],
  permissions: permissions,
  content: const [],
  limits: const [],
);

AccessCapability _botUse([String? tier]) =>
    AccessCapability(kind: AccessCapabilityKindEnum.botPeriodUse, tier: tier);

/// The presentation twin of the engine's `capabilityAllows` for `bot.use`. Each
/// case here is one the TypeScript rule decides the same way.
void main() {
  test('an unknown access is never a lock', () {
    expect(seatingLocked(null, 'gold'), isFalse);
    expect(seatingLocked(null, null), isFalse);
  });

  test('an unparameterized grant covers every tier', () {
    final access = _access([_botUse()]);
    expect(seatingLocked(access, null), isFalse);
    expect(seatingLocked(access, 'gold'), isFalse);
  });

  test('a tiered grant covers only its own tier, and not an untiered bot', () {
    final access = _access([_botUse('gold')]);
    expect(seatingLocked(access, 'gold'), isFalse);
    expect(seatingLocked(access, 'silver'), isTrue);
    expect(seatingLocked(access, null), isTrue);
  });

  test('another capability is not a bot grant', () {
    final access = _access([
      AccessCapability(kind: AccessCapabilityKindEnum.replayPeriodRead),
    ]);
    expect(seatingLocked(access, null), isTrue);
  });
}
