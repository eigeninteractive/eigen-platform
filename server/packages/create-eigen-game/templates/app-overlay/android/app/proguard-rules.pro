# Flutter engine rules are added automatically by the Flutter Gradle plugin.
#
# image_cropper ships its own consumer-proguard-rules.pro (OkHttp + uCrop).
# google_sign_in (Credential Manager), in_app_update, and in_app_review use
# Google Play libraries that include their own consumer rules via Maven.
#
# Only libraries confirmed to lack consumer rules are listed below: currently
# none. Add a keep rule here only after confirming a dependency ships no
# consumer rules of its own and is stripped by R8.
