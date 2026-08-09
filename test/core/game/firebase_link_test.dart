import 'dart:convert';
import 'dart:io';

import 'package:eigen_flutter/src/codegen/firebase_link.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as path;

const _wrangler = '''
{
  "name": "go-fish",
  // Non-secret Worker environment variables, used by local development and
  // uploaded with every deployment.
  "vars": {
    "FIREBASE_PROJECT_ID": "",
    // Trusted automatically for browser API and socket access.
    "WEB_APP_ORIGIN": "http://localhost:7357"
  },
  "d1_databases": [{ "binding": "GAME_DB" }]
}
''';

Map<String, dynamic> _googleServices({
  List<Map<String, dynamic>> oauth = const [],
}) => {
  'project_info': {'project_id': 'go-fish-1a2b3'},
  'client': [
    {
      'client_info': {'android_client_info': {}},
      'oauth_client': oauth,
    },
  ],
};

Map<String, dynamic> _firebaseJson(String projectId) => {
  'flutter': {
    'platforms': {
      'android': {
        'default': {'projectId': projectId},
      },
      'dart': {
        'lib/firebase_options.dart': {
          'projectId': projectId,
          'configurations': {'web': '1:1:web:1'},
        },
      },
    },
  },
};

void main() {
  group('setJsonString', () {
    test('replaces the value and leaves every comment standing', () {
      final result = setJsonString(
        _wrangler,
        'FIREBASE_PROJECT_ID',
        'go-fish-1a2b3',
      );

      expect(result, isNotNull);
      expect(result, contains('"FIREBASE_PROJECT_ID": "go-fish-1a2b3"'));
      // The reason this rewrites in place rather than decoding and re-encoding.
      expect(result, contains('// Non-secret Worker environment variables'));
      expect(
        result,
        contains('// Trusted automatically for browser API and socket access.'),
      );
      expect(result, contains('"WEB_APP_ORIGIN": "http://localhost:7357"'));
      expect(result, contains('"d1_databases"'));
    });

    test('overwrites a value that was already set', () {
      final once = setJsonString(_wrangler, 'FIREBASE_PROJECT_ID', 'first')!;

      expect(
        setJsonString(once, 'FIREBASE_PROJECT_ID', 'second'),
        contains('"FIREBASE_PROJECT_ID": "second"'),
      );
    });

    test('accepts unusual but legal spacing', () {
      expect(
        setJsonString(
          '{"FIREBASE_PROJECT_ID"  :   ""}',
          'FIREBASE_PROJECT_ID',
          'real',
        ),
        '{"FIREBASE_PROJECT_ID": "real"}',
      );
    });

    test('refuses a second occurrence rather than picking one', () {
      // Two assignments, and no way to know which was meant. A commented-out
      // one counts, which is the point: this is a file its owner edits.
      const duplicated = '''
{
  // "FIREBASE_PROJECT_ID": "the old one",
  "vars": { "FIREBASE_PROJECT_ID": "" }
}
''';

      expect(setJsonString(duplicated, 'FIREBASE_PROJECT_ID', 'real'), isNull);
    });

    test('refuses when the key is absent or is not a string', () {
      expect(
        setJsonString('{ "vars": {} }', 'FIREBASE_PROJECT_ID', 'real'),
        isNull,
      );
      expect(
        setJsonString(
          '{ "vars": { "FIREBASE_PROJECT_ID": 7 } }',
          'FIREBASE_PROJECT_ID',
          'real',
        ),
        isNull,
      );
    });

    test('escapes what it writes', () {
      expect(
        setJsonString(
          '{"FIREBASE_PROJECT_ID": ""}',
          'FIREBASE_PROJECT_ID',
          'a"b',
        ),
        contains(r'"FIREBASE_PROJECT_ID": "a\"b"'),
      );
    });
  });

  group('the readers', () {
    test('take the web client, not the android one', () {
      final source = jsonEncode(
        _googleServices(
          oauth: [
            {'client_id': 'android.apps', 'client_type': 1},
            {'client_id': 'web.apps', 'client_type': 3},
          ],
        ),
      );

      expect(webClientIdFrom(source), 'web.apps');
    });

    test('report null when the provider has never been enabled', () {
      expect(webClientIdFrom(jsonEncode(_googleServices())), isNull);
    });

    test('read the project from the Dart output, not the Android entry', () {
      expect(
        projectIdFrom(jsonEncode(_firebaseJson('go-fish-1a2b3'))),
        'go-fish-1a2b3',
      );
      expect(
        projectIdFrom(
          jsonEncode({
            'flutter': {
              'platforms': {
                'android': {
                  'default': {'projectId': 'go-fish'},
                },
              },
            },
          }),
        ),
        isNull,
      );
    });

    test('treat unreadable content as absent', () {
      expect(webClientIdFrom('{ not json'), isNull);
      expect(projectIdFrom('{ not json'), isNull);
    });
  });

  group('linkFirebaseProject', () {
    late Directory root;

    setUp(() {
      root = Directory.systemTemp.createTempSync('eigen-link-');
      Directory(path.join(root.path, 'server')).createSync(recursive: true);
      Directory(
        path.join(root.path, 'app', 'android', 'app'),
      ).createSync(recursive: true);
      File(
        path.join(root.path, 'server', 'wrangler.jsonc'),
      ).writeAsStringSync(_wrangler);
      File(path.join(root.path, 'app', 'app-config.json')).writeAsStringSync(
        '${const JsonEncoder.withIndent('  ').convert({'API_BASE_URL': 'http://localhost:8787', 'APP_HOST': '', 'GOOGLE_WEB_CLIENT_ID': '', 'FIREBASE_VAPID_KEY': ''})}\n',
      );
    });

    tearDown(() => root.deleteSync(recursive: true));

    Directory app() => Directory(path.join(root.path, 'app'));
    Directory server() => Directory(path.join(root.path, 'server'));
    String wrangler() => File(
      path.join(root.path, 'server', 'wrangler.jsonc'),
    ).readAsStringSync();
    Map<String, dynamic> appConfig() =>
        jsonDecode(
              File(
                path.join(root.path, 'app', 'app-config.json'),
              ).readAsStringSync(),
            )
            as Map<String, dynamic>;

    void configure({String? projectId, List<Map<String, dynamic>>? oauth}) {
      if (projectId != null) {
        File(
          path.join(root.path, 'app', 'firebase.json'),
        ).writeAsStringSync(jsonEncode(_firebaseJson(projectId)));
      }
      if (oauth != null) {
        File(
          path.join(root.path, 'app', 'android', 'app', 'google-services.json'),
        ).writeAsStringSync(jsonEncode(_googleServices(oauth: oauth)));
      }
    }

    test('fills both files in a combined project', () {
      configure(
        projectId: 'go-fish-1a2b3',
        oauth: [
          {'client_id': 'web.apps.googleusercontent.com', 'client_type': 3},
        ],
      );

      final link = linkFirebaseProject(appRoot: app(), workerRoot: server());

      expect(link.projectId, 'go-fish-1a2b3');
      expect(link.googleWebClientId, 'web.apps.googleusercontent.com');
      expect(wrangler(), contains('"FIREBASE_PROJECT_ID": "go-fish-1a2b3"'));
      expect(appConfig(), {
        'API_BASE_URL': 'http://localhost:8787',
        'APP_HOST': '',
        'GOOGLE_WEB_CLIENT_ID': 'web.apps.googleusercontent.com',
        // Not knowable from any CLI, so it stays for the reader.
        'FIREBASE_VAPID_KEY': '',
      });
    });

    test('keeps the app half when there is no Worker to write to', () {
      configure(
        projectId: 'go-fish-1a2b3',
        oauth: [
          {'client_id': 'web.apps.googleusercontent.com', 'client_type': 3},
        ],
      );

      // An app-only repository. The project is still reported, so the caller
      // can name it, but nothing outside the app is touched.
      final link = linkFirebaseProject(appRoot: app());

      expect(link.projectId, 'go-fish-1a2b3');
      expect(appConfig()['GOOGLE_WEB_CLIENT_ID'], isNotEmpty);
      expect(wrangler(), contains('"FIREBASE_PROJECT_ID": ""'));
    });

    test('leaves everything alone when Google sign-in is off', () {
      configure(projectId: 'go-fish-1a2b3', oauth: []);

      final link = linkFirebaseProject(appRoot: app(), workerRoot: server());

      expect(link.googleWebClientId, isNull);
      expect(appConfig()['GOOGLE_WEB_CLIENT_ID'], '');
      // The half that was knowable still landed.
      expect(wrangler(), contains('"FIREBASE_PROJECT_ID": "go-fish-1a2b3"'));
    });

    test('does not throw when Firebase wrote nothing to read', () {
      final link = linkFirebaseProject(appRoot: app(), workerRoot: server());

      expect(link.projectId, isNull);
      expect(link.googleWebClientId, isNull);
      expect(wrangler(), contains('"FIREBASE_PROJECT_ID": ""'));
    });
  });
}
