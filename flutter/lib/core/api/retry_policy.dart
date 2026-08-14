import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The two retry policies the engine client installs, one at the transport
/// layer and one at the provider layer, kept together because they draw the same
/// line: a retry is only ever safe for a failure whose outcome is unknown (a
/// transport blip), never for one the server decided.
///
/// Neither survives the process. An intent that must outlive a restart would
/// need its id written down before its first dispatch, which nothing here does;
/// see `command_id.dart`.

/// Whether a failed request should be retried at the transport layer, wired into
/// the `RetryInterceptor` on the engine Dio.
///
/// True only for a *repeatable* request whose failure carried no response: a
/// dropped connection or a timeout, where the request may never have reached the
/// server. A failure that carried a response is the server's answer, not a blip,
/// so it is left for `engineCall` to surface (a 429's Retry-After included).
///
/// A request is repeatable if replaying it cannot change the outcome beyond what
/// the first attempt already did:
///
/// * a GET, which changes nothing;
/// * a mutation carrying an `Idempotency-Key`, because the engine commits one
///   receipt per key and replays that committed result rather than applying the
///   command twice.
///
/// Dio replays the original [RequestOptions], so a retry sends the *same* key by
/// construction — which is exactly the property the receipt needs. A mutation
/// without a key stays unretried: its outcome after a timeout is genuinely
/// unknown, and resending it could apply the same intent twice.
FutureOr<bool> retryTransient(DioException error, int attempt) {
  if (error.response != null) return false;
  if (!_repeatable(error.requestOptions)) return false;
  return switch (error.type) {
    DioExceptionType.connectionTimeout ||
    DioExceptionType.sendTimeout ||
    DioExceptionType.receiveTimeout ||
    DioExceptionType.connectionError => true,
    _ => false,
  };
}

/// Whether resending [options] is safe; see [retryTransient].
bool _repeatable(RequestOptions options) {
  if (options.method.toUpperCase() == 'GET') return true;
  return options.headers.keys.any(
    (name) => name.toLowerCase() == 'idempotency-key',
  );
}

/// The provider-retry policy installed on the root [ProviderScope].
///
/// Riverpod's default retries *every* non-[Error] failure up to ten times,
/// including an [EngineException], which is the server deliberately saying no (a
/// full lobby, an unknown game, a failed validation). Re-running those is
/// pointless and needlessly hammers the server, so this narrows automatic
/// retries to the one class a retry can resolve: a transport failure that
/// carried no response. `engineCall` leaves exactly those as a raw
/// [DioException] with a null `response`; a server answer has already become an
/// [EngineException] and is never retried here.
///
/// The coarse, whole-build net above [retryTransient]. It runs only for read
/// providers; mutations happen in notifier methods, not in `build`, so they are
/// never governed by this. Two tries with short exponential backoff; a read that
/// exhausts them surfaces to the UI, which can still refresh manually.
Duration? engineProviderRetry(int retryCount, Object error) {
  const maxRetries = 2;
  if (retryCount >= maxRetries) return null;
  final transient = error is DioException && error.response == null;
  if (!transient) return null;
  return Duration(milliseconds: 200 * (1 << retryCount)); // 200ms, then 400ms
}
