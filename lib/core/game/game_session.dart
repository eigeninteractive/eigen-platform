import 'package:eigen_api/eigen_api.dart';

/// One game's live session, as the client holds it: the newest snapshot the
/// server stated, plus the frame being rendered and the one it replaced.
///
/// This is the whole of a game screen's state. Nothing else holds a piece of it,
/// which is the point: the server states the complete truth for this seat in one
/// value, so status, roster, version and observation can never disagree with
/// each other, and there is no second source for any of them to drift from.
///
/// [frame] is not always [Session.frame]. While a gap is animating, the frames
/// the client missed are emitted one at a time against the *previous* envelope,
/// so a client that missed a finish plays out the moves and only then shows the
/// outcome. That is why the frame is carried alongside the snapshot rather than
/// read out of it.
class GameSession {
  const GameSession({
    required this.snapshot,
    required this.frame,
    this.previousFrame,
  });

  /// The envelope: status, roster, timing, config, and the immutable header.
  final Session snapshot;

  /// The frame to render, or null when there is nothing to render: the waiting
  /// room, a game aborted before it started, or a viewer holding no seat.
  final Frame? frame;

  /// The frame [frame] replaced, or null when none was rendered before it.
  ///
  /// Null on a cold load and on the first frame of a game, which is exactly when
  /// a game must *not* animate: there is no predecessor the player saw, so the
  /// cue is history rather than an event. Games read this through
  /// `GameContentContext.transition`.
  final Frame? previousFrame;

  /// Monotonic per game, incremented by every commit. Totally orders snapshots
  /// where `version` cannot, because a lobby change has none.
  int get seq => snapshot.seq;

  GameStatus get status => snapshot.status;

  /// The version being rendered, which during a gap animation is behind
  /// [Session.version]. Null in the lobby.
  int? get version => frame?.version ?? snapshot.version;

  /// Whether the game has reached a status nothing can move it out of.
  bool get isTerminal =>
      status == GameStatus.finished || status == GameStatus.aborted;

  /// Advance to a newly stated snapshot.
  GameSession applySnapshot(Session next) =>
      GameSession(snapshot: next, frame: next.frame, previousFrame: frame);

  /// Advance one recovered frame without touching the envelope.
  ///
  /// Status, roster and `seq` hold still while a missed span plays out, so an
  /// animation cannot render a finished game's banner over a mid-game move. The
  /// authoritative snapshot lands last and supplies them.
  GameSession applyGapFrame(Frame gap) =>
      GameSession(snapshot: snapshot, frame: gap, previousFrame: frame);

  /// Whether [next] should replace this session.
  ///
  /// Ordinarily that is simply a higher `seq`, which resolves a command response
  /// racing its own socket push, a duplicate delivery, and a reconnect that
  /// missed nothing. The terminal clause is not a special case bolted on: a
  /// finished or aborted game is absorbing, so such a snapshot needs no
  /// ordering, and the abort teardown drops the storage `seq` lived in, so a
  /// re-initialised object legitimately reports a lower one.
  bool supersededBy(Session next) =>
      next.seq > seq ||
      (!isTerminal &&
          (next.status == GameStatus.finished ||
              next.status == GameStatus.aborted));
}
