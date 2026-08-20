import 'package:dio/dio.dart';
import 'package:eigen_api/eigen_api.dart';

import '../api/engine_call.dart';

/// Push-delivery platforms understood by the engine.
enum DevicePlatform { web, ios, android }

/// Push registrations for the authenticated user's installations.
class DeviceRepository {
  DeviceRepository(Dio http) : _api = MeApi(http);

  final MeApi _api;

  /// Creates or refreshes an installation registration.
  Future<void> upsert({
    required String fid,
    required DevicePlatform platform,
  }) => engineCall(
    () => _api.registerDevice(
      deviceRegistration: DeviceRegistration(
        fid: fid,
        platform: switch (platform) {
          DevicePlatform.web => DeviceRegistrationPlatformEnum.web,
          DevicePlatform.ios => DeviceRegistrationPlatformEnum.ios,
          DevicePlatform.android => DeviceRegistrationPlatformEnum.android,
        },
      ),
    ),
  );

  /// Deletes an installation registration. The operation is idempotent.
  Future<void> delete({required String fid}) =>
      engineCall(() => _api.unregisterDevice(fid: fid));
}
