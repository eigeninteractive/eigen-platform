# eigen_firebase

Optional Firebase adapters for EigenInteractive Flutter applications.

`eigen_flutter` owns presentation and provider-neutral ports. This package
implements those ports with Firebase Auth, Analytics, Crashlytics, Cloud
Messaging, and Firebase Installations. Apps that use another identity or push
provider do not depend on this package.

```dart
import 'package:eigen_firebase/eigen_firebase.dart';
import 'package:eigen_flutter/eigen_flutter.dart';

await runFirebaseEngineApp(
  module: gameModule,
  config: appConfig,
  firebaseOptions: DefaultFirebaseOptions.currentPlatform,
  firebase: const FirebaseAdapterConfig(
    googleWebClientId: googleWebClientId,
    vapidKey: firebaseVapidKey,
  ),
  onBackgroundMessage: backgroundMessageHandler,
  telemetry: FirebaseTelemetryPolicy.releaseOnly(),
);
```

Telemetry collection defaults to disabled. Enabling it at the composition root
is an explicit app/privacy decision.

Configure a Flutter app and its optional sibling Worker from the app directory:

```bash
dart run eigen_firebase:configure_firebase --worker ../server
```

See [EigenInteractive documentation](https://eigeninteractive.com) for project
configuration and deployment.
