import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The two retry policies the engine client installs, one at the transport
/// layer and one at the provider layer, kept together because they draw the same
/// line: a retry is only ever safe for a failure whose outcome is unknown (a
/// transport blip), never for one the server decided.
///
/// Whether a failed request should be retried at the transport layer, wired into
/// the `RetryInterceptor` on the engine Dio.
///
/// True only for a *repeatable* request whose failure carried no response: a
/// dropped connection or a timeout, where the request may never have reached the
/// server. A failure that carried a response is the server's answer, not a blip,
/// so it is left for `engineCall` to surface (a 429's Retry-After included).
///
/// Only GET is repeatable. A mutation whose response is lost has an ambiguous
/// outcome, so the client resynchronizes instead of resending it automatically.
FutureOr<bool> retryTransient(DioException error, int attempt) {
  if (error.response != null) return false;
  if (error.requestOptions.method.toUpperCase() != 'GET') return false;
  return switch (error.type) {
    DioExceptionType.connectionTimeout ||
    DioExceptionType.sendTimeout ||
    DioExceptionType.receiveTimeout ||
    DioExceptionType.connectionError => true,
    _ => false,
  };
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
