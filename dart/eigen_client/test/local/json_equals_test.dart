import 'dart:convert';

import 'package:checks/checks.dart';
import 'package:eigen_client/eigen_client.dart';
import 'package:test/test.dart';

void main() {
  test('two states that differ only in key order are the same state', () {
    final ours = {
      'scores': [1, 2],
      'turn': 0,
    };
    final theirs = jsonDecode('{"turn":0,"scores":[1,2]}');

    check(jsonEquals(ours, theirs)).isTrue();
  });

  test('list order is content, not presentation', () {
    check(
      jsonEquals(
        {
          'seats': [0, 1],
        },
        {
          'seats': [1, 0],
        },
      ),
    ).isFalse();
  });

  test('a number written as 1 and as 1.0 is one number', () {
    check(jsonEquals({'bank': 1}, jsonDecode('{"bank":1.0}'))).isTrue();
  });

  test('an optional field written as null equals one left out', () {
    // Two codecs for one schema: the server writes the null, the generated
    // Dart payload omits it, and both validate. See the RPS observation's
    // `yourMove`, which is nullable and not required.
    check(jsonEquals({'yourMove': null}, <String, Object?>{})).isTrue();
    check(jsonEquals({'yourMove': 'rock'}, <String, Object?>{})).isFalse();
  });

  test('a map is never equal to a scalar', () {
    check(jsonEquals({'a': 1}, 'a')).isFalse();
    check(jsonEquals('a', {'a': 1})).isFalse();
  });

  test('nesting is compared all the way down', () {
    check(
      jsonEquals(
        {
          'board': [
            {'cell': 1},
          ],
        },
        {
          'board': [
            {'cell': 2},
          ],
        },
      ),
    ).isFalse();
  });
}
