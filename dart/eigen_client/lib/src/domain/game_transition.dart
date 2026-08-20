import 'package:eigen_client/src/domain/game_frame.dart';

/// The step from one frame to the next: the unit a game animates.
///
/// Animation is the presentation of a frame *transition*, not of a state, and
/// not of a diff. Two frames are given rather than one because the step is what
/// carries meaning; what happened during it is read from [to]'s observation,
/// where `computeObservation` embedded the cues this seat is permitted to see.
/// Never diff [from] against [to] to work out the cause: a hidden move leaves no
/// visible footprint, two different causes can leave the same one, and a
/// composite resolution collapses into a single diff.
///
/// A game receives this as `GameContentContext.transition`, and it is null
/// exactly when animating would be wrong: a cold load, a rejoin, or the opening
/// frame. In those cases the newest frame is still correct and complete, so
/// render it statically and treat its cues as history rather than as events.
class GameTransition {
  const GameTransition({required this.from, required this.to});

  /// The frame the player was looking at.
  final GameFrame from;

  /// The frame now on screen, one version later.
  final GameFrame to;
}
