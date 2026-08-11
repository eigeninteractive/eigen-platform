import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;

import 'package:eigen_api/eigen_api.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

/// Builds the browser-compatible authenticated socket URI.
///
/// WebSocket browser APIs cannot attach an Authorization header to the HTTP
/// upgrade, so the Firebase ID token is carried in the query string. Uri's
/// query encoder protects tokens and game ids containing reserved characters.
Uri buildGameSocketUri({
  required String apiBaseUrl,
  required String gameId,
  required String token,
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
    queryParameters: {'token': token},
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
/// Reconnects on drop with capped exponential backoff, emitting
/// [GameSocketConnected] each time so the caller can recover whatever it missed
/// while disconnected. It deliberately owns *only* the connection: ordering,
/// gap detection, and recovery are the repository's, because recovering a gap
/// means an HTTP range fetch this layer knows nothing about.
///
/// Auth rides the query string rather than a header because browsers cannot set
/// headers on a WebSocket upgrade. The token is re-read on every connection
/// attempt, so a reconnect after a long background period presents a fresh one.
class GameSocket {
  GameSocket({
    required this._baseUrl,
    required this._auth,
    this._initialBackoff = const Duration(milliseconds: 500),
    this._maxBackoff = const Duration(seconds: 30),
  });

  final String _baseUrl;
  final FirebaseAuth _auth;
  final Duration _initialBackoff;
  final Duration _maxBackoff;

  /// Connects to [gameId]'s socket, reconnecting until the subscription is
  /// cancelled.
  ///
  /// The stream never completes on its own and never surfaces a connection
  /// failure as an error: a dropped socket is an expected condition on mobile,
  /// and the recovery for it is the reconnect this already performs. Errors
  /// that are *not* recoverable that way, such as a malformed message, are logged and
  /// skipped rather than tearing down a working connection.
  ///
  /// A reconnect needs no announcement, because the server's first message on
  /// the new connection is the current snapshot. When nothing was missed it
  /// carries a `seq` the caller already holds and is discarded there, so the
  /// common case on a flaky connection costs one message and no rebuild.
  Stream<GameSocketEvent> connect(String gameId) async* {
    var backoff = _initialBackoff;

    while (true) {
      final token = await _auth.currentUser?.getIdToken();
      if (token == null) {
        // Signed out, most likely mid-teardown as the auth redirect runs.
        // Nothing to listen to, and retrying cannot help.
        return;
      }

      WebSocketChannel? channel;
      try {
        channel = WebSocketChannel.connect(_socketUri(gameId, token));
        await channel.ready;
        backoff = _initialBackoff;

        await for (final message in channel.stream) {
          final event = _decode(message);
          if (event != null) yield event;
        }
      } catch (error, stack) {
        developer.log(
          'game socket for $gameId dropped; reconnecting',
          name: 'eigen.socket',
          error: error,
          stackTrace: stack,
        );
      } finally {
        await channel?.sink.close();
      }

      await Future<void>.delayed(backoff);
      final doubled = backoff * 2;
      backoff = doubled > _maxBackoff ? _maxBackoff : doubled;
    }
  }

  /// `https://host` → `wss://host/api/engine/games/{id}/socket?token=…`.
  Uri _socketUri(String gameId, String token) {
    return buildGameSocketUri(
      apiBaseUrl: _baseUrl,
      gameId: gameId,
      token: token,
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
      return null;
    }
  }
}
