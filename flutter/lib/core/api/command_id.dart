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
/// Generating one here is only correct for a mutation whose outcome the caller
/// waits for. An intent that must survive the process, so that a retry after a
/// restart still reuses its id, needs the id written down before its first
/// dispatch; that durable journal is not built yet, so nothing in this package
/// currently retries a mutation across a restart.
String newCommandId() => _uuid.v7();
