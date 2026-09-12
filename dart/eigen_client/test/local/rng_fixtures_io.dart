import 'dart:convert';
import 'dart:io';

/// Reads `test/fixtures/rng.json` if the testkit has generated one.
///
/// Deliberately tolerant: the file is owned by the TypeScript testkit and may
/// hold cases of other kinds, or not exist at all, and neither is a reason to
/// fail this package's suite.
List<Map<String, dynamic>>? loadRngFixtureCases() {
  final file = File('test/fixtures/rng.json');
  if (!file.existsSync()) return null;
  final document = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
  final cases = document['cases'] as List<dynamic>? ?? const [];
  return [
    for (final entry in cases.cast<Map<String, dynamic>>())
      if (entry['kind'] == 'rng') entry,
  ];
}
