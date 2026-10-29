import 'dart:convert';
import 'dart:io';

import 'package:args/args.dart';
import 'package:eigen_codegen/eigen_codegen.dart';
import 'package:test/test.dart';

void main() {
  test(
    'CLI check detects orphan files and generation replaces its directory',
    () async {
      final root = Directory.systemTemp.createTempSync('eigen-fixture-cli-');
      addTearDown(() => root.deleteSync(recursive: true));
      final contract = File('${root.path}/contract.json')
        ..writeAsStringSync(
          jsonEncode({
            'formatVersion': 1,
            'game': 'Empty',
            'versions': <String, dynamic>{},
            'fixtures': <dynamic>[],
          }),
        );
      final output = '${root.path}/payloads.dart';
      final fixtures = Directory('${root.path}/generated');
      Future<ProcessResult> run({bool check = false, String? directory}) =>
          Process.run(Platform.resolvedExecutable, [
            'run',
            'bin/generate_payloads.dart',
            '--contract',
            contract.path,
            '--output',
            output,
            '--fixtures-output',
            directory ?? fixtures.path,
            if (check) '--check',
          ]);
      expect((await run()).exitCode, 0);
      File('${fixtures.path}/orphan.json').writeAsStringSync('{}');
      final stale = await run(check: true);
      expect(stale.exitCode, 1);
      expect(stale.stderr, contains('orphan.json'));
      expect((await run()).exitCode, 0);
      expect(fixtures.listSync(), isEmpty);
      expect((await run(check: true)).exitCode, 0);
      expect((await run(directory: root.path)).exitCode, 64);
      expect(contract.existsSync(), isTrue);
      expect(File(output).existsSync(), isTrue);
    },
    timeout: const Timeout(Duration(minutes: 2)),
  );

  test('parses generation and check options', () {
    final options = PayloadGeneratorCli().parse([
      '--contract=game-contract.json',
      '--output',
      'lib/game/generated/payloads.dart',
      '--fixtures-output',
      'test/fixtures',
      '--check',
    ]);

    expect(options, isNotNull);
    expect(options!.contract, 'game-contract.json');
    expect(options.output, 'lib/game/generated/payloads.dart');
    expect(options.fixturesOutput, 'test/fixtures');
    expect(options.check, isTrue);
  });

  test('requires contract and output when generating', () {
    expect(
      () => PayloadGeneratorCli().parse(const []),
      throwsA(
        isA<ArgParserException>().having(
          (error) => error.message,
          'message',
          contains('contract'),
        ),
      ),
    );
  });

  test('help does not require generation options', () {
    final cli = PayloadGeneratorCli();

    expect(cli.parse(const ['--help']), isNull);
    expect(cli.parse(const ['-h']), isNull);
    expect(cli.usage, contains('--contract=<path>'));
    expect(cli.usage, contains('--output=<path>'));
    expect(cli.usage, contains('--check'));
  });

  test('rejects unknown options', () {
    expect(
      () => PayloadGeneratorCli().parse([
        '--contract',
        'game-contract.json',
        '--output',
        'payloads.dart',
        '--wat',
      ]),
      throwsA(isA<ArgParserException>()),
    );
  });
}
