/// Reloads the page into the newest deployed version of the app.
///
/// The production gateway calls this only when compiled for the web.
Future<void> reloadBrowser() async {
  throw UnsupportedError('Browser reload is unavailable on this platform.');
}
