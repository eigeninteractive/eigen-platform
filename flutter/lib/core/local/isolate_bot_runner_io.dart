import 'dart:isolate';

import 'package:eigen_client/eigen_client.dart';

/// Runs a bot's brain in a short-lived isolate, so thinking never drops a
/// frame.
///
/// A brain is game code with no bound on how long it may take, and the local
/// engine calls it on the device rather than waking a server. On native that is
/// what `Isolate.run` is for: the job goes across, the move comes back, and the
/// isolate ends.
///
/// The price is [LocalBotJob]'s sendability contract, which that class states:
/// a rules unit must be `const`, its inputs plain JSON values, and nothing a
/// brain captures may be a provider, a widget, or any other live object. A
/// brain that violates it fails here rather than silently running on the main
/// thread.
final class IsolateBotRunner implements BotRunner {
  const IsolateBotRunner();

  @override
  Future<Map<String, dynamic>> run(LocalBotJob job) =>
      Isolate.run(() => const InlineBotRunner().run(job));
}
