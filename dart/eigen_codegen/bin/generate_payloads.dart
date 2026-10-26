import 'dart:convert';
import 'dart:io';

import 'package:args/args.dart';
import 'package:eigen_codegen/src/payload_cli.dart';
import 'package:eigen_codegen/src/payload_generator.dart';

void main(List<String> arguments) {
  final cli = PayloadGeneratorCli();
  try {
    final options = cli.parse(arguments);
    if (options == null) {
      stdout.writeln(cli.usage);
      return;
    }
    final contractFile = File(options.contract);
    if (options.fixturesOutput case final fixturesOutput?) {
      final owned = Directory(fixturesOutput).absolute.uri.normalizePath();
      for (final source in [options.contract, options.output]) {
        final path = File(source).absolute.uri.normalizePath();
        if (path.path.startsWith(owned.path)) {
          throw FormatException(
            '--fixtures-output must not contain the contract or Dart output: $source',
          );
        }
      }
    }
    final contract =
        jsonDecode(contractFile.readAsStringSync()) as Map<String, dynamic>;
    final generated = generatePayloadLibrary(contract);
    final output = File(options.output);

    if (options.check) {
      var stale = false;
      if (!output.existsSync() || output.readAsStringSync() != generated) {
        stderr.writeln(
          '${output.path} is stale; run dart run eigen_codegen:generate_payloads',
        );
        stale = true;
      }
      if (options.fixturesOutput case final fixturesOutput?) {
        final directory = Directory(fixturesOutput);
        for (final path in contractFixtureDrift(contract, directory)) {
          stderr.writeln('${directory.path}/$path is stale or unexpected');
          stale = true;
        }
      }
      if (stale) exitCode = 1;
      return;
    }

    output.parent.createSync(recursive: true);
    output.writeAsStringSync(generated);
    if (options.fixturesOutput case final fixturesOutput?) {
      writeContractFixtures(contract, Directory(fixturesOutput));
    }
    stdout.writeln('Generated ${output.path}');
  } on ArgParserException catch (error) {
    stderr
      ..writeln('generate_payloads: ${error.message}')
      ..writeln()
      ..writeln(cli.usage);
    exitCode = 64;
  } on FormatException catch (error) {
    stderr.writeln('generate_payloads: ${error.message}');
    exitCode = 64;
  } on FileSystemException catch (error) {
    stderr.writeln('generate_payloads: ${error.message}');
    exitCode = 74;
  }
}
