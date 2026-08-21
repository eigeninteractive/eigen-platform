import 'package:eigen_flutter/core/storage/storage_backend.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/experimental/persist.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'storage_provider.g.dart';

/// Whether API snapshots persist across application launches on this platform.
///
/// Browser sessions keep provider state in memory and fetch fresh data after a
/// reload. Native apps temporarily use Riverpod's SQLite adapter; repository
/// caches will move to Drift when the native read model is introduced.
const persistentApiCacheEnabled = !kIsWeb;

/// Native storage backend for persisted Riverpod API snapshots.
///
/// Do not read this provider unless [persistentApiCacheEnabled] is true.
@Riverpod(keepAlive: true)
Future<Storage<String, String>> storage(Ref ref) => openJsonStorage();
