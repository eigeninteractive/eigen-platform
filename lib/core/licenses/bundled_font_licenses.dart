import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Registers the notices for the font files bundled by this package.
///
/// Package assets use a package-qualified key when read from an application
/// that depends on `eigen_flutter`, matching the package-qualified font family
/// names used by the theme.
void registerBundledFontLicenses() {
  LicenseRegistry.addLicense(() async* {
    final inter = await rootBundle.loadString(
      'packages/eigen_flutter/fonts/OFL-Inter.txt',
    );
    yield LicenseEntryWithLineBreaks(const ['Inter'], inter);

    final spaceGrotesk = await rootBundle.loadString(
      'packages/eigen_flutter/fonts/OFL-SpaceGrotesk.txt',
    );
    yield LicenseEntryWithLineBreaks(const ['Space Grotesk'], spaceGrotesk);
  });
}
