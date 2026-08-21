import 'package:dio/dio.dart';
import 'package:dio_smart_retry/dio_smart_retry.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:eigen_flutter/core/api/retry_policy.dart';
import 'package:eigen_flutter/core/config/app_config.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'engine_api_providers.g.dart';

/// Supplies the current short-lived bearer token to engine transports.
///
/// Identity adapters override this provider. The null-token default keeps the
/// transport usable with servers that install a local or public auth policy.
@Riverpod(keepAlive: true)
AccessTokenProvider engineAccessToken(Ref ref) =>
    () async => null;

/// The app-wide HTTP client for the engine: the data layer's single backend
/// handle.
///
/// Only repositories and data services may watch this or the API providers
/// below; everything above them consumes domain types. Enforced by
/// `test/core/architecture/api_isolation_test.dart`.
///
/// The base URL is the origin only: every generated route already carries its
/// `/api/engine` prefix.
///
/// The generated `EigenApi` facade is deliberately not used, but not because it
/// can't take this Dio. It can (`EigenApi(dio: ..., interceptors: const [])`
/// installs none of its own). The reason is the split below: each repository
/// depends on the one narrow `*Api` it needs, so a fake in a test is that one
/// resource, not the whole surface. The facade would hand every repository all
/// of them.
@Riverpod(keepAlive: true)
Dio engineDio(Ref ref) {
  final config = ref.watch(appConfigProvider).engine;
  final dio = Dio(
    BaseOptions(
      baseUrl: config.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 20),
    ),
  );
  dio.interceptors.add(
    BearerTokenInterceptor(ref.watch(engineAccessTokenProvider)),
  );
  dio.interceptors.add(ref.watch(serverClockProvider).interceptor);
  // Transport-level retry for requests that are safe to repeat. Retries a
  // failed GET that carried no response (a dropped connection or timeout)
  // twice with short backoff. Mutations with ambiguous outcomes are never
  // retried. Any failure that carried a response is the server's decision,
  // left untouched for
  // `engineCall` to map (a 429 included; its Retry-After is respected, not
  // auto-retried). The retry replays the whole interceptor chain, so
  // The bearer-token interceptor re-attaches a fresh token each attempt; added
  // last so it is the outermost handler.
  dio.interceptors.add(
    RetryInterceptor(
      dio: dio,
      retries: 2,
      retryDelays: const [
        Duration(milliseconds: 200),
        Duration(milliseconds: 400),
      ],
      retryEvaluator: retryTransient,
    ),
  );
  ref.onDispose(dio.close);
  return dio;
}

/// Server time, tracked from the `Date` header of every engine response.
///
/// Deadlines on the wire are absolute server timestamps, so every countdown in
/// the app measures against this rather than the device clock.
@Riverpod(keepAlive: true)
ServerClock serverClock(Ref ref) => ServerClock();

/// The pure Dart engine runtime.
///
/// Flutter configures authentication, timeouts, retry, and server-time tracking
/// on [engineDioProvider]. The client package owns generated HTTP resources,
/// repositories, socket-ticket exchange, and live-session coordination.
@Riverpod(keepAlive: true)
EigenClient engineClient(Ref ref) => EigenClient(
  http: ref.watch(engineDioProvider),
  baseUrl: ref.watch(appConfigProvider).engine.apiBaseUrl,
);
