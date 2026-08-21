import 'dart:io';

import 'package:checks/checks.dart';
import 'package:flutter_test/flutter_test.dart';

/// Paths (relative to `lib/`) allowed to talk to the server.
final _allowedCallers = [
  // The transport core: Dio, the interceptors, the socket, the API providers.
  RegExp(r'^core/api/'),
  // The error vocabulary. `humanize` names `DioException` to tell a transport
  // failure from a server refusal - it classifies a thrown object rather than
  // making a request. Widgets still depend only on `EngineException` and
  // `humanize`, never on Dio.
  RegExp(r'^core/errors/'),
];

/// What "talking to the server" looks like in source: the HTTP client itself,
/// or any of the generated per-resource API classes.
///
/// Deliberately narrower than "imports `eigen_api`". The generated *models* are
/// the app's domain vocabulary - a `GamePlayer` composes a `Player`, a provider
/// caches one - and confining those to the data layer would mean hand-written
/// mirrors and a mapping layer at the boundary, which is the exact thing this
/// architecture rejects. What must stay in the data layer is the *capability to
/// make a request*, not the types that come back.
final _serverAccess = <RegExp>[
  RegExp(r"import 'package:dio/"),
  RegExp(r'\b(?:Games|Social|Me|Players|Bots|BotWebhook)Api\b'),
];

/// Flutter-side layering checks supplement the compiler-enforced
/// `eigen_client` package boundary. Pure HTTP repositories belong in that
/// package; Flutter owns only UI, state, and platform adapters.
void main() {
  test('the reusable package does not own an app shell', () {
    final pubspec = File('pubspec.yaml').readAsStringSync();
    final sources = Directory('lib')
        .listSync(recursive: true)
        .whereType<File>()
        .where((file) => file.path.endsWith('.dart'))
        .map((file) => file.readAsStringSync())
        .join('\n');

    check(pubspec).not((value) => value.contains('eigen_shell:'));
    check(pubspec).not((value) => value.contains('go_router:'));
    check(pubspec).not((value) => value.contains('flutter_native_splash:'));
    check(sources).not((value) => value.contains('package:eigen_shell/'));
    check(sources).not((value) => value.contains("import 'package:go_router/"));
    check(File('lib/app_runner.dart').existsSync()).isFalse();
    check(Directory('lib/features/profile').existsSync()).isFalse();
    check(Directory('lib/features/rating').existsSync()).isFalse();
    check(Directory('lib/features/social').existsSync()).isFalse();
  });

  test('the Flutter barrel delegates its pure surface to eigen_client', () {
    final barrel = File('lib/eigen_flutter.dart').readAsStringSync();

    check(
      because:
          'game apps should receive the pure domain vocabulary transitively',
      barrel,
    ).contains("export 'package:eigen_client/eigen_client.dart';");

    check(
      because:
          'the generated client remains an eigen_client implementation detail',
      barrel,
    ).not((source) => source.contains('package:eigen_api/'));
  });

  test('the public auth contract is provider neutral', () {
    final domain = Directory('lib/features/auth/domain')
        .listSync()
        .whereType<File>()
        .where((file) => file.path.endsWith('.dart'))
        .map((file) => file.readAsStringSync())
        .join('\n');

    check(domain).not((source) => source.contains('package:firebase_'));
    check(domain).not((source) => source.contains('package:google_sign_in/'));

    final barrel = File('lib/eigen_flutter.dart').readAsStringSync();
    check(barrel).contains("export 'features/auth/domain/auth_gateway.dart';");
    check(barrel).contains("export 'features/auth/domain/auth_user.dart';");
  });

  test('the Flutter package has no Firebase implementation dependency', () {
    final firebaseImports = Directory('lib')
        .listSync(recursive: true)
        .whereType<File>()
        .where((file) => file.path.endsWith('.dart'))
        .where((file) {
          final source = file.readAsStringSync();
          return source.contains("package:firebase_") ||
              source.contains("package:google_sign_in/") ||
              source.contains("package:flutter_local_notifications/");
        })
        .map((file) => file.path.replaceFirst(RegExp(r'^lib/'), ''))
        .toList();

    check(
      because:
          'provider SDKs belong in eigen_firebase, connected only through '
          'the public adapter boundary',
      firebaseImports,
    ).isEmpty();
  });

  test('only the data layer talks to the server', () {
    final libDir = Directory('lib');
    check(
      because: 'test must run from the package root',
      libDir.existsSync(),
    ).isTrue();

    final violations = <String>[];
    final dartFiles = libDir
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'));

    for (final file in dartFiles) {
      final source = file.readAsStringSync();
      final hits = _serverAccess.where((p) => p.hasMatch(source)).toList();
      if (hits.isEmpty) continue;

      final relative = file.path
          .replaceFirst(RegExp(r'^lib/'), '')
          .replaceAll(r'\', '/');
      if (_allowedCallers.any((p) => p.hasMatch(relative))) continue;
      violations.add(relative);
    }

    check(
      because:
          'these files reach the server outside the data layer; route the '
          'call through a repository instead (generated models may be used '
          'anywhere - only the API classes and Dio are restricted)',
      violations,
    ).isEmpty();
  });
}
