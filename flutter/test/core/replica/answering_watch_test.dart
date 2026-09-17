import 'dart:async';

import 'package:checks/checks.dart';
import 'package:drift/backends.dart';
import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:eigen_flutter/core/replica/answering_watch.dart';
import 'package:flutter_test/flutter_test.dart';

/// A database whose statements answer only when a test lets them, standing in
/// for a worker the browser has taken away.
class _HeldDatabase extends DelegatedDatabase {
  _HeldDatabase(this.gate) : super(_HeldDelegate(gate));

  final Completer<void> gate;
}

class _HeldDelegate extends DatabaseDelegate {
  _HeldDelegate(this.gate);

  final Completer<void> gate;

  @override
  late final DbVersionDelegate versionDelegate = const NoVersionDelegate();

  @override
  TransactionDelegate get transactionDelegate => const NoTransactionDelegate();

  @override
  bool get isOpen => true;

  @override
  Future<void> open(QueryExecutorUser user) async {}

  @override
  Future<void> close() async {}

  @override
  Future<void> runBatched(BatchedStatements statements) => gate.future;

  @override
  Future<void> runCustom(String statement, List<Object?> args) => gate.future;

  @override
  Future<int> runInsert(String statement, List<Object?> args) async {
    await gate.future;
    return 0;
  }

  @override
  Future<QueryResult> runSelect(String statement, List<Object?> args) async {
    await gate.future;
    return QueryResult.fromRows(const []);
  }

  @override
  Future<int> runUpdate(String statement, List<Object?> args) async {
    await gate.future;
    return 0;
  }
}

/// The database opening; drift refuses statements before it.
class _User extends QueryExecutorUser {
  @override
  int get schemaVersion => 1;

  @override
  Future<void> beforeOpen(
    QueryExecutor executor,
    OpeningDetails details,
  ) async {}
}

void main() {
  const timeout = Duration(milliseconds: 30);

  test('a statement that never answers reports the replica stopped', () async {
    final watch = AnsweringWatch(timeout: timeout);
    final gate = Completer<void>();
    final executor = _HeldDatabase(gate).interceptWith(watch);
    await executor.ensureOpen(_User());
    final reported = <bool>[];
    watch.answering.listen(reported.add);

    unawaited(executor.runSelect('SELECT 1', const []));
    await Future<void>.delayed(timeout * 3);

    check(watch.isAnswering).isFalse();
    check(reported).deepEquals([false]);
  });

  test('an answer, however late, says it is back', () async {
    final watch = AnsweringWatch(timeout: timeout);
    final gate = Completer<void>();
    final executor = _HeldDatabase(gate).interceptWith(watch);
    await executor.ensureOpen(_User());
    final reported = <bool>[];
    watch.answering.listen(reported.add);

    final statement = executor.runSelect('SELECT 1', const []);
    await Future<void>.delayed(timeout * 3);
    gate.complete();
    await statement;
    await pumpEventQueue();

    check(watch.isAnswering).isTrue();
    check(reported).deepEquals([false, true]);
  });

  test('a statement answering in time reports nothing at all', () async {
    final watch = AnsweringWatch(timeout: timeout);
    final database = NativeDatabase.memory().interceptWith(watch);
    await database.ensureOpen(_User());
    final reported = <bool>[];
    watch.answering.listen(reported.add);

    await database.runCustom('CREATE TABLE rows (x INTEGER)', const []);

    check(watch.isAnswering).isTrue();
    check(reported).isEmpty();
  });
}
