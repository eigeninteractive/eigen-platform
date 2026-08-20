# eigen_client

The pure Dart runtime for EigenInteractive clients. It owns the protocol-facing
domain model, generated HTTP resources, repositories, server clock, typed error
mapping, socket-ticket exchange, and live-session gap recovery. It has no
dependency on Flutter, Riverpod, Firebase, navigation, analytics, storage, or
widgets.

Game implementors normally depend on
[`eigen_flutter`](https://pub.dev/packages/eigen_flutter), which composes this
package with Flutter presentation adapters. Depend on `eigen_client` directly
for a non-Flutter client or for pure Dart tests and tooling.

Configure authentication and transport once, then use the repositories exposed
by `EigenClient`:

```dart
final clock = ServerClock();
final http = Dio(BaseOptions(baseUrl: engineOrigin));
http.interceptors
  ..add(BearerTokenInterceptor(accessTokenProvider))
  ..add(clock.interceptor);

final client = EigenClient(http: http, baseUrl: engineOrigin);
final lobby = await client.games.getLobby();
final profile = await client.profile.getProfile();
```

The caller owns the Dio instance, including its timeouts, retry policy, token
provider, and lifecycle. `EigenClient` owns HTTP resource composition and
obtains a short-lived, game-scoped ticket before each live socket connection.
