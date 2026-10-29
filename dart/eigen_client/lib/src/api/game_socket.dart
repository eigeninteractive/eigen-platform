import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;

import 'package:dio/dio.dart';
import 'package:eigen_api/eigen_api.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'engine_exception.dart';

/// A visible failure of the live feed, retaining the underlying diagnostic.
///
/// [retrying] means this subscription owns automatic recovery. Otherwise the
/// caller must explicitly reconnect after fixing the cause or signing in.
class GameConnectionException implements Exception {
  const GameConnectionException(this.cause, {required this.retrying});

  final Object cause;
  final bool retrying;

  @override
  String toString() => 'Game connection failed: $cause';
}

bool _canReconnect(Object error) => switch (error) {
  EngineException(:final statusCode) =>
    statusCode == 408 ||
        statusCode == 502 ||
        statusCode == 503 ||
        statusCode == 504,
  DioException(:final type, response: null) => switch (type) {
    DioExceptionType.connectionTimeout ||
    DioExceptionType.sendTimeout ||
    DioExceptionType.receiveTimeout ||
    DioExceptionType.connectionError => true,
    _ => false,
  },
  WebSocketChannelException() => true,
  _ => false,
};

/// Builds the browser-compatible authenticated socket URI.
///
/// WebSocket browser APIs cannot attach an Authorization header to the HTTP
/// upgrade, so a narrow, short-lived socket ticket is carried in the query
/// string. Firebase credentials remain on the ordinary HTTPS request that
/// obtains the ticket. Uri's query encoder protects tickets and game ids
/// containing reserved characters.
Uri buildGameSocketUri({
  required String apiBaseUrl,
  required String gameId,
  required String ticket,
}) {
  final base = Uri.parse(apiBaseUrl);
  final socketScheme = switch (base.scheme) {
    'https' => 'wss',
    'http' => 'ws',
    _ => throw ArgumentError.value(
      apiBaseUrl,
      'apiBaseUrl',
      'must use http or https',
    ),
  };
  return base.replace(
    scheme: socketScheme,
    path: '/api/engine/games/$gameId/socket',
    queryParameters: {'ticket': ticket},
  );
}

/// The socket carries exactly one message: the complete live truth about the
/// game as this seat sees it.
///
/// The server never reads from this socket, since every client-to-server command
/// rides HTTP, so this is a one-way feed of [Session] snapshots. There is
/// deliberately nothing else on it, and no "connected" signal to reason about:
/// an open always answers with a snapshot, so there is never a window in which
/// a client holds a frame without the status it belongs to, and never anything
/// to infer from the bare fact of connecting.
///
/// `frame` is only ever this socket's own seat's view. The server resolves the
/// seat from the connection's authenticated principal against the roster before
/// sending, so another player's hidden information never crosses the wire, and a
/// client holding no seat receives the envelope with no frame at all.
typedef GameSocketEvent = Session;

/// Opens a game's socket and keeps it open for the screen's lifetime.
///
/// Reconnects on transient failures with capped exponential backoff. The first
/// snapshot on each connection lets the caller recover whatever it missed
/// while disconnected. It deliberately owns *only* the connection: ordering,
/// gap detection, and recovery are the repository's, because recovering a gap
/// means an HTTP range fetch this layer knows nothing about.
///
/// A fresh short-lived ticket is obtained on every connection attempt, so a
/// reconnect after a long background period never reuses expired credentials.
class GameSocket {
  GameSocket({
    required this._baseUrl,
    required this._ticketProvider,
    this._initialBackoff = const Duration(milliseconds: 500),
    this._maxBackoff = const Duration(seconds: 30),
  });

  final String _baseUrl;
  final Future<String> Function(String gameId) _ticketProvider;
  final Duration _initialBackoff;
  final Duration _maxBackoff;

  /// Connects to [gameId]'s socket, reconnecting until the subscription is
  /// cancelled or a failure requires user/operator intervention.
  ///
  /// Failures emit [GameConnectionException]. Network failures and temporary
  /// gateway/service failures retry; authentication, permissions, rate limits,
  /// server bugs and malformed snapshots stop. Other layers must not add a
  /// second retry loop. A fresh subscription is an explicit retry.
  ///
  /// A reconnect needs no announcement, because the server's first message on
  /// the new connection is the current snapshot. When nothing was missed it
  /// carries a `seq` the caller already holds and is discarded there, so the
  /// common case on a flaky connection costs one message and no rebuild.
  Stream<GameSocketEvent> connect(String gameId) async* {
    var backoff = _initialBackoff;

    while (true) {
      WebSocketChannel? channel;
      try {
        final ticket = await _ticketProvider(gameId);
        channel = WebSocketChannel.connect(_socketUri(gameId, ticket));
        await channel.ready;
        await for (final message in channel.stream) {
          final event = _decode(message);
          if (event != null) {
            backoff = _initialBackoff;
            yield event;
          }
        }
        throw WebSocketChannelException('The game connection closed');
      } catch (error, stack) {
        final retrying = _canReconnect(error);
        developer.log(
          'game socket for $gameId failed; retrying=$retrying',
          name: 'eigen.socket',
          error: error,
          stackTrace: stack,
        );
        yield* Stream<GameSocketEvent>.error(
          GameConnectionException(error, retrying: retrying),
          stack,
        );
        if (!retrying) return;
      } finally {
        await channel?.sink.close();
      }

      await Future<void>.delayed(backoff);
      final doubled = backoff * 2;
      backoff = doubled > _maxBackoff ? _maxBackoff : doubled;
    }
  }

  /// `https://host` → `wss://host/api/engine/games/{id}/socket?ticket=…`.
  Uri _socketUri(String gameId, String ticket) {
    return buildGameSocketUri(
      apiBaseUrl: _baseUrl,
      gameId: gameId,
      ticket: ticket,
    );
  }

  /// Decodes one wire message, or null if it is not one we understand.
  ///
  /// An unrecognised `type` is skipped rather than thrown: it means the server
  /// added a message kind this build predates, and dropping it degrades far
  /// better than killing a live game's socket.
  GameSocketEvent? _decode(dynamic message) {
    try {
      final json = jsonDecode(message as String) as Map<String, dynamic>;
      return json['type'] == 'session' ? Session.fromJson(json) : null;
    } catch (error, stack) {
      developer.log(
        'unreadable game socket message',
        name: 'eigen.socket',
        error: error,
        stackTrace: stack,
      );
      rethrow;
    }
  }
}
