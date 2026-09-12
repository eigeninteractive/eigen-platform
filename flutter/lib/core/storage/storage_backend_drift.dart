import 'package:eigen_flutter/core/local/drift_json_storage.dart';
import 'package:eigen_flutter/core/local/local_database.dart';
import 'package:flutter_riverpod/experimental/persist.dart';

/// Opens the persisted-provider storage for this platform.
///
/// No conditional import any more: [LocalDatabase] resolves the platform
/// itself, a file on native and IndexedDB through drift's worker on the web, so
/// there is one storage implementation and one set of behaviours to reason
/// about.
Future<Storage<String, String>> openJsonStorage(LocalDatabase database) async =>
    DriftJsonStorage(database);
