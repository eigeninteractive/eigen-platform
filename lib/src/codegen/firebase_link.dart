/// Copies the deployment values that exist only once a Firebase project does
/// into the two files that read them.
///
/// Neither value is a decision. `GOOGLE_WEB_CLIENT_ID` is the OAuth client
/// Firebase created for this project, and `FIREBASE_PROJECT_ID` is the project
/// itself; both are sitting in files FlutterFire has just written. Asking
/// someone to copy them by hand is how a first launch fails on a configuration
/// error long after the tool said it was finished.
library;

import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as path;

/// What was found and written, so the caller can report what is still missing.
class FirebaseLink {
  const FirebaseLink({this.projectId, this.googleWebClientId});

  /// The project written into the Worker's `wrangler.jsonc`, or null when there
  /// was no Worker to write to and no project recorded.
  final String? projectId;

  /// The OAuth web client written into `app-config.json`, or null when Google
  /// sign-in has not been enabled and there is therefore nothing to copy.
  final String? googleWebClientId;
}

/// The OAuth web client id in an Android `google-services.json`.
///
/// `client_type: 3` is Google's own numbering for the web client, and it is the
/// one both platforms sign in with, which is why an app with no web target
/// still needs it.
///
/// Null is an ordinary outcome. Firebase creates this client when the Google
/// sign-in provider is enabled, a console action no CLI performs, so a project
/// that has never had it enabled has an empty `oauth_client` array.
String? webClientIdFrom(String source) {
  final decoded = _decodeObject(source);
  if (decoded == null) return null;
  for (final client in decoded['client'] as List<dynamic>? ?? const []) {
    if (client is! Map<String, dynamic>) continue;
    for (final oauth in client['oauth_client'] as List<dynamic>? ?? const []) {
      if (oauth is! Map<String, dynamic>) continue;
      final id = oauth['client_id'];
      if (oauth['client_type'] == 3 && id is String && id.isNotEmpty) return id;
    }
  }
  return null;
}

/// The project FlutterFire recorded for the Dart output this app reads.
///
/// Read defensively: `firebase.json` is FlutterFire's record rather than
/// anything written here, and a shape that does not match is the same answer as
/// a run that never happened.
String? projectIdFrom(String source) {
  final platforms = _decodeObject(source)?['flutter'] as Map<String, dynamic>?;
  final dart =
      (platforms?['platforms'] as Map<String, dynamic>?)?['dart']
          as Map<String, dynamic>?;
  final selected = dart?['lib/firebase_options.dart'] as Map<String, dynamic>?;
  final projectId = selected?['projectId'];
  return projectId is String && projectId.isNotEmpty ? projectId : null;
}

Map<String, dynamic>? _decodeObject(String source) {
  try {
    final value = jsonDecode(source);
    return value is Map<String, dynamic> ? value : null;
  } on FormatException {
    // A file this only reads is never worth failing a finished configuration
    // for. The value stays unset, and the caller says so.
    return null;
  }
}

/// Replaces the string value of `key`, leaving every other byte alone.
///
/// `wrangler.jsonc` is a file its owner edits and comments, and Cloudflare
/// recommends JSONC for new projects, so decoding and re-encoding it is not an
/// option: it would delete every comment in it. Rewriting the one assignment in
/// place is enough, and does not require understanding the rest of the document.
///
/// The safety is in the count, not in the pattern. A key that appears anywhere
/// other than exactly once, whether commented out, duplicated, or nested under
/// some other object, means the file is not the one this knows how to edit, so
/// nothing is written and the caller says so. Guessing which of two matches was
/// meant is the only outcome worth avoiding here.
///
/// Returns null when the key is absent, ambiguous, or not set to a string.
String? setJsonString(String source, String key, String value) {
  final assignment = RegExp('"${RegExp.escape(key)}"\\s*:\\s*"[^"\\\\]*"');
  final matches = assignment.allMatches(source).toList();
  if (matches.length != 1) return null;
  return source.replaceRange(
    matches.single.start,
    matches.single.end,
    '${jsonEncode(key)}: ${jsonEncode(value)}',
  );
}

/// Fills in what configuring Firebase has just made knowable.
///
/// [appRoot] is the Flutter application. [workerRoot] is its Cloudflare Worker,
/// when there is one: an app-only repository passes null and simply keeps the
/// half that concerns it, which is why this is a parameter rather than a
/// sibling directory guessed at from [appRoot].
///
/// Nothing here throws. Firebase is configured by the time it runs, and a value
/// that could not be copied is a line of output rather than a failure.
FirebaseLink linkFirebaseProject({
  required Directory appRoot,
  Directory? workerRoot,
}) {
  final projectId = _read(
    path.join(appRoot.path, 'firebase.json'),
  )?.let(projectIdFrom);
  if (projectId != null && workerRoot != null) {
    final wrangler = File(path.join(workerRoot.path, 'wrangler.jsonc'));
    final source = _read(wrangler.path);
    if (source != null) {
      final updated = setJsonString(source, 'FIREBASE_PROJECT_ID', projectId);
      if (updated != null) wrangler.writeAsStringSync(updated);
    }
  }

  final clientId = _read(
    path.join(appRoot.path, 'android', 'app', 'google-services.json'),
  )?.let(webClientIdFrom);
  if (clientId != null) {
    final config = File(path.join(appRoot.path, 'app-config.json'));
    final decoded = _read(config.path)?.let(_decodeObject);
    if (decoded != null) {
      config.writeAsStringSync(
        '${const JsonEncoder.withIndent('  ').convert({...decoded, 'GOOGLE_WEB_CLIENT_ID': clientId})}\n',
      );
    }
  }

  return FirebaseLink(projectId: projectId, googleWebClientId: clientId);
}

String? _read(String file) {
  final handle = File(file);
  return handle.existsSync() ? handle.readAsStringSync() : null;
}

extension<T extends Object> on T {
  R? let<R>(R Function(T) transform) => transform(this);
}
