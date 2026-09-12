import 'package:eigen_client/eigen_client.dart';

/// Runs a bot's brain on the main thread, because Flutter has no isolates on
/// the web.
///
/// Named for its native twin so the engine wires one port either way. A brain
/// that thinks for long must yield cooperatively here, which the `FutureOr`
/// return of `LocalBotAction` permits; a Web Worker would lift that
/// requirement and is a build-step change behind this class, not a change to
/// any game's contract.
final class IsolateBotRunner implements BotRunner {
  const IsolateBotRunner();

  @override
  Future<Map<String, dynamic>> run(LocalBotJob job) =>
      const InlineBotRunner().run(job);
}
