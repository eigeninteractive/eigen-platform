import 'dart:io';

import 'package:eigen_codegen/eigen_codegen.dart';
import 'package:test/test.dart';

void main() {
  const objectSchema = <String, dynamic>{
    'type': 'object',
    'properties': <String, dynamic>{
      'value': <String, dynamic>{'type': 'integer'},
    },
    'required': <String>['value'],
  };

  Map<String, dynamic> contract() => <String, dynamic>{
    'formatVersion': 1,
    'game': 'Counter',
    'versions': <String, dynamic>{
      '2': <String, dynamic>{
        'schemas': <String, dynamic>{
          'observation': objectSchema,
          'action': objectSchema,
          'config': objectSchema,
          'state': objectSchema,
        },
      },
      '1': <String, dynamic>{
        'schemas': <String, dynamic>{
          'observation': objectSchema,
          'action': objectSchema,
          'config': objectSchema,
          'state': objectSchema,
        },
      },
    },
    'fixtures': <dynamic>[],
  };

  test('generates stable names and rules bases for every version', () {
    final source = generatePayloadLibrary(contract());

    expect(source, contains('final class CounterV1Observation'));
    expect(source, contains('final class CounterV2Observation'));
    expect(source, contains('abstract class CounterV1RulesBase'));
    expect(source, contains('abstract class CounterV2RulesBase'));
    expect(
      source,
      contains(
        'extends GameRules<CounterV1Observation, CounterV1Action, CounterV1Config>',
      ),
    );
    expect(source, isNot(contains('GamePayloadCodec')));
    expect(
      source.indexOf('CounterV1Observation'),
      lessThan(source.indexOf('CounterV2Observation')),
    );
  });

  test('generates the state type and the local rules base per version', () {
    final source = generatePayloadLibrary(contract());

    // Offline play runs the hooks on the device, so the state payload needs a
    // type and a codec the local kernel can validate a hook's return with.
    expect(source, contains('final class CounterV1State'));
    expect(source, contains('final class CounterV2State'));
    expect(source, contains('abstract class CounterV1LocalRulesBase'));
    expect(source, contains('abstract class CounterV2LocalRulesBase'));
    // Whitespace-insensitive: the declaration is long enough that the
    // formatter's wrapping is not part of the contract.
    expect(
      source.replaceAll(RegExp(r'\s'), ''),
      contains(
        'extendsLocalGameRules<CounterV1State,CounterV1Observation,'
        'CounterV1Action,CounterV1Config>',
      ),
    );
    for (final member in const [
      'CounterV1Config parseConfig(Map<String, dynamic> json)',
      'CounterV1State parseState(Map<String, dynamic> json)',
      'Map<String, dynamic> serializeState(CounterV1State state)',
      'CounterV1Action parseAction(Map<String, dynamic> json)',
      'Map<String, dynamic> serializeAction(CounterV1Action action)',
      'CounterV1Observation parseObservation(Map<String, dynamic> json)',
      'Map<String, dynamic> serializeObservation(',
    ]) {
      expect(source, contains(member));
    }
    // The hooks stay abstract: only the codecs are generated.
    expect(source, isNot(contains('initialState')));
  });

  test('rejects a version that declares no state schema', () {
    final value = contract();
    final schemas =
        ((value['versions'] as Map<String, dynamic>)['1']
                as Map<String, dynamic>)['schemas']
            as Map<String, dynamic>;
    schemas.remove('state');

    expect(
      () => generatePayloadLibrary(value),
      throwsA(
        isA<FormatException>().having(
          (error) => error.message,
          'message',
          contains('no state schema'),
        ),
      ),
    );
  });

  test('derives Dart type names from the contract game name', () {
    final exampleSource = generatePayloadLibrary(
      contract()..['game'] = 'Example Game',
    );
    expect(exampleSource, contains('final class ExampleGameV1Observation'));
    expect(exampleSource, contains('abstract class ExampleGameV1RulesBase'));

    final numericSource = generatePayloadLibrary(contract()..['game'] = '2048');
    expect(numericSource, contains('final class Game2048V1Observation'));
  });

  test('escapes unusual wire names and enum values as Dart literals', () {
    final unusualSchema = <String, dynamic>{
      'type': 'object',
      'properties': <String, dynamic>{
        r"quote'$key": <String, dynamic>{
          'type': 'string',
          'enum': <String>[r"ready'$now"],
        },
      },
      'required': <String>[r"quote'$key"],
    };
    final value = contract();
    final schemas =
        ((value['versions'] as Map<String, dynamic>)['1']
                as Map<String, dynamic>)['schemas']
            as Map<String, dynamic>;
    schemas['action'] = unusualSchema;

    final source = generatePayloadLibrary(value);

    expect(source, contains(r'\$key'));
    expect(source, contains(r'\$now'));
    expect(source, contains('enum CounterV1ActionQuoteKey'));
  });

  test('rejects wire members that normalize to the same Dart identifier', () {
    final collidingSchema = <String, dynamic>{
      'type': 'object',
      'properties': <String, dynamic>{
        'display-name': <String, dynamic>{'type': 'string'},
        'display_name': <String, dynamic>{'type': 'string'},
      },
    };
    final value = contract();
    final schemas =
        ((value['versions'] as Map<String, dynamic>)['1']
                as Map<String, dynamic>)['schemas']
            as Map<String, dynamic>;
    schemas['action'] = collidingSchema;

    expect(() => generatePayloadLibrary(value), throwsFormatException);
  });

  test('rejects unsupported contract versions', () {
    expect(
      () => generatePayloadLibrary(<String, dynamic>{
        ...contract(),
        'formatVersion': 99,
      }),
      throwsFormatException,
    );
  });

  test('accepts draft metadata and definitions beside a root reference', () {
    final referencedSchema = <String, dynamic>{
      r'$schema': 'https://json-schema.org/draft/2020-12/schema',
      r'$ref': r'#/$defs/CounterV1Action',
      r'$defs': <String, dynamic>{
        'CounterV1Action': <String, dynamic>{
          'type': 'object',
          'properties': <String, dynamic>{
            'value': <String, dynamic>{'type': 'integer'},
          },
          'required': <String>['value'],
        },
      },
    };
    final value = contract();
    final schemas =
        ((value['versions'] as Map<String, dynamic>)['1']
                as Map<String, dynamic>)['schemas']
            as Map<String, dynamic>;
    schemas['action'] = referencedSchema;

    final source = generatePayloadLibrary(value);

    expect(source, contains('final class CounterV1Action'));
  });

  test('rejects schema constraints it cannot enforce', () {
    final value = contract();
    final schemas =
        ((value['versions'] as Map<String, dynamic>)['1']
                as Map<String, dynamic>)['schemas']
            as Map<String, dynamic>;
    schemas['action'] = <String, dynamic>{
      'type': 'object',
      'properties': <String, dynamic>{
        'code': <String, dynamic>{'type': 'string', 'pattern': r'^[A-Z]+$'},
      },
    };

    expect(
      () => generatePayloadLibrary(value),
      throwsA(
        isA<FormatException>().having(
          (error) => error.message,
          'message',
          contains('never ignores schema constraints'),
        ),
      ),
    );
  });

  test('copies fixtures without permitting path traversal', () {
    final directory = Directory.systemTemp.createTempSync('eigen-fixtures-');
    addTearDown(() => directory.deleteSync(recursive: true));

    final value = contract()
      ..['fixtures'] = <dynamic>[
        <String, dynamic>{
          'path': 'v1/case.json',
          'document': <String, dynamic>{'schemaVersion': 1},
        },
      ];
    writeContractFixtures(value, directory);
    expect(
      File('${directory.path}/v1/case.json').readAsStringSync(),
      contains('"schemaVersion": 1'),
    );

    value['fixtures'] = <dynamic>[
      <String, dynamic>{
        'path': '../escape.json',
        'document': <String, dynamic>{},
      },
    ];
    expect(
      () => writeContractFixtures(value, directory),
      throwsFormatException,
    );
  });
}
