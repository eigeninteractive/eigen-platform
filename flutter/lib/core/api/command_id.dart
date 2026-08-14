import 'package:uuid/uuid.dart';

const _uuid = Uuid();

/// A fresh identity for one logical mutation.
///
/// Travels as the `Idempotency-Key` request header, which every engine mutation
/// requires. One id belongs to one intent and is reused unchanged on every retry
/// of it: the server replays that intent's committed result rather than applying
/// it twice, and refuses the same id carrying a different request.
///
/// UUIDv7 rather than v4 because its leading timestamp sorts, which makes a
/// pending-command log readable in the order the player acted.
///
/// The id lives as long as the request does. Within that life it is reused
/// exactly as intended: a transport failure is retried by the engine Dio's
/// `RetryInterceptor`, which replays the original request and therefore the
/// original key, so the server replays its committed receipt rather than
/// applying the command twice (see `retry_policy.dart`).
///
/// It deliberately does not outlive the process. An intent that must survive a
/// restart, so a retry minutes later still reuses its id, needs the id written
/// down before its first dispatch — a durable journal this package does not
/// have. That is a choice, not an omission: a game action carries a deadline the
/// server will refuse once passed, and the board is authoritative and visible on
/// reconnect, so replaying a stale action would mostly defer a rejection. The
/// case that would justify one is an intent with no deadline whose loss a player
/// would notice, such as creating or joining over a flaky connection.
String newCommandId() => _uuid.v7();
