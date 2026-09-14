import 'dart:math';

final Random _secureRandom = Random.secure();

/// An RFC 4122 version-4 identity for one client-initiated operation.
String _newOperationId() {
  final bytes = List<int>.generate(16, (_) => _secureRandom.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes
      .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
      .join();
  return '${hex.substring(0, 8)}-'
      '${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-'
      '${hex.substring(16, 20)}-'
      '${hex.substring(20)}';
}

/// Creates an identity for one game-creation operation.
///
/// Keep the returned value with the pending UI operation and reuse it after an
/// ambiguous transport failure. A deliberate second game must use a new value.
String newGameCreationId() => _newOperationId();

/// Creates an identity for one hosted-checkout operation.
///
/// Reuse it the same way: a retry under the same identity returns the checkout
/// the server already opened rather than opening a second one, and reusing it
/// for a different offer or return URL is refused.
String newCheckoutOperationId() => _newOperationId();
