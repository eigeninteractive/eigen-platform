/// Loads the generated `rng` twin fixtures when the platform can read files.
///
/// The vectors in `rng_test.dart` are the port's proof of exactness; this file
/// is the anti-drift half, reading the cases the TypeScript testkit records
/// straight from the kernel. The browser build has no file system, so the
/// fixture pass runs on the VM and the browser run checks the hardcoded
/// vectors, which is what the web arithmetic actually needs proving on.
library;

export 'rng_fixtures_unsupported.dart'
    if (dart.library.io) 'rng_fixtures_io.dart';
