import 'package:dio/dio.dart';

/// Obtains the current access token for one engine request.
///
/// The callback is invoked for every request so an identity adapter can use its
/// own cache and refresh policy without the transport retaining credentials.
typedef AccessTokenProvider = Future<String?> Function();

/// Adds a bearer token supplied by an identity adapter to engine requests.
///
/// This transport knows only the standard HTTP bearer mechanism. Firebase,
/// another identity provider, or a test fake supplies [AccessTokenProvider].
final class BearerTokenInterceptor extends Interceptor {
  BearerTokenInterceptor(this._tokenProvider);

  final AccessTokenProvider _tokenProvider;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _tokenProvider();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }
}
