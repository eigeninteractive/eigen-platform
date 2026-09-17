import 'dart:async';

import 'package:drift/drift.dart';

/// How long one statement may go unanswered before the replica is reported as
/// not answering.
///
/// Well beyond any statement the replica runs, which are local and take
/// milliseconds, so reaching it means something has stopped rather than slowed.
const defaultAnswerTimeout = Duration(seconds: 20);

/// Watches whether the database still answers at all (decision 0014).
///
/// A browser may terminate the worker hosting the replica -- Chrome for Android
/// does when the app has been in the background -- and nothing tells the page.
/// There is no event for it: drift's own channel documents that a worker or tab
/// going away is not something a channel can observe. The statement simply
/// never answers, so lists keep showing what they last read and writes wait
/// forever.
///
/// So this times statements instead. It reports the database as not answering
/// once one has gone unanswered for [timeout], and as answering again the
/// moment any statement completes, whether it succeeded or failed: what matters
/// is that something came back. Opening is deliberately not timed, because
/// loading a large replica out of IndexedDB can take a while and means nothing
/// is wrong.
///
/// Nothing here recovers anything. Reopening the database is the app's to
/// offer, and a reload is what does it.
final class AnsweringWatch extends QueryInterceptor {
  AnsweringWatch({this.timeout = defaultAnswerTimeout});

  /// How long one statement may go unanswered.
  final Duration timeout;

  final _changes = StreamController<bool>.broadcast();
  var _answering = true;

  /// Whether the database is answering, as it changes.
  Stream<bool> get answering => _changes.stream;

  /// Whether the database is answering as of now.
  bool get isAnswering => _answering;

  Future<T> _timed<T>(Future<T> Function() statement) async {
    final overdue = Timer(timeout, () => _report(answering: false));
    try {
      return await statement();
    } finally {
      overdue.cancel();
      _report(answering: true);
    }
  }

  void _report({required bool answering}) {
    if (_answering == answering || _changes.isClosed) return;
    _answering = answering;
    _changes.add(answering);
  }

  @override
  Future<void> runCustom(
    QueryExecutor executor,
    String statement,
    List<Object?> args,
  ) => _timed(() => executor.runCustom(statement, args));

  @override
  Future<int> runInsert(
    QueryExecutor executor,
    String statement,
    List<Object?> args,
  ) => _timed(() => executor.runInsert(statement, args));

  @override
  Future<int> runUpdate(
    QueryExecutor executor,
    String statement,
    List<Object?> args,
  ) => _timed(() => executor.runUpdate(statement, args));

  @override
  Future<int> runDelete(
    QueryExecutor executor,
    String statement,
    List<Object?> args,
  ) => _timed(() => executor.runDelete(statement, args));

  @override
  Future<List<Map<String, Object?>>> runSelect(
    QueryExecutor executor,
    String statement,
    List<Object?> args,
  ) => _timed(() => executor.runSelect(statement, args));

  @override
  Future<void> runBatched(
    QueryExecutor executor,
    BatchedStatements statements,
  ) => _timed(() => executor.runBatched(statements));

  @override
  Future<void> commitTransaction(TransactionExecutor inner) =>
      _timed(inner.send);

  @override
  Future<void> close(QueryExecutor inner) async {
    await inner.close();
    await _changes.close();
  }
}
