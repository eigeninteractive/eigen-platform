/// Firebase adapters for EigenInteractive Flutter applications.
///
/// This package is optional. `eigen_flutter` remains provider-neutral; apps
/// that choose Firebase use [initializeEigenFirebase] at their composition
/// root and install its returned overrides through `eigen_shell` or
/// `EigenFlutterScope`.
library;

export 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
export 'package:firebase_messaging/firebase_messaging.dart' show RemoteMessage;

export 'src/firebase_adapter.dart'
    show
        FirebaseAdapterConfig,
        FirebaseTelemetryPolicy,
        initializeEigenFirebase;
