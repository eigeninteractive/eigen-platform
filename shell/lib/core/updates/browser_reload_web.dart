import 'dart:async';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:web/web.dart' as web;

/// Reloads the page into the newest deployed version of the app.
///
/// A plain reload would come back to the same build. The service worker
/// answers from the version it precached, and a newly deployed worker waits
/// until no tab still runs the old one, which a reload does not change: the
/// reloading tab is still one. So this first asks the browser for the newest
/// worker, lets it finish precaching, has it take over, and only then reloads
/// (decision 0014). Where there is no worker to update, or it will not
/// cooperate in reasonable time, it reloads anyway.
Future<void> reloadBrowser() async {
  try {
    await _activateNewestWorker().timeout(const Duration(seconds: 30));
  } on Object {
    // Nothing to activate, or the worker could not be reached: reload as is.
  }
  web.window.location.reload();
}

Future<void> _activateNewestWorker() async {
  if (!web.window.navigator.has('serviceWorker')) return;
  final workers = web.window.navigator.serviceWorker;
  final registration = await workers.getRegistration().toDart;
  if (registration == null) return;
  await registration.update().toDart;
  if (registration.installing case final installing?) {
    await _installed(installing);
  }
  final waiting = registration.waiting;
  if (waiting == null) return;
  final tookOver = Completer<void>();
  workers.addEventListener(
    'controllerchange',
    ((web.Event _) {
      if (!tookOver.isCompleted) tookOver.complete();
    }).toJS,
  );
  // The Workbox worker's own handshake for leaving the waiting state.
  waiting.postMessage({'type': 'SKIP_WAITING'}.jsify());
  await tookOver.future;
}

/// Completes once [worker] has finished installing, whether it succeeded.
Future<void> _installed(web.ServiceWorker worker) {
  final done = Completer<void>();
  void settle() {
    if (worker.state != 'installing' && !done.isCompleted) done.complete();
  }

  worker.addEventListener('statechange', ((web.Event _) => settle()).toJS);
  settle();
  return done.future;
}
