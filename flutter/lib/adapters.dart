/// Provider integration points for optional EigenInteractive adapters.
library;

export 'core/analytics/analytics_provider.dart' show analyticsServiceProvider;
export 'core/analytics/analytics_service.dart'
    show AnalyticsService, NoopAnalyticsService;
export 'core/api/engine_api_providers.dart' show engineAccessTokenProvider;
export 'core/config/app_config.dart'
    show AppConfig, EngineConfig, appConfigProvider;
export 'core/navigation/providers/navigation_providers.dart'
    show goRouterProvider, navigationObserversProvider;
export 'core/notifications/notification_provider.dart'
    show notificationServiceProvider;
export 'core/notifications/notification_service.dart';
export 'features/auth/domain/auth_gateway.dart';
export 'features/auth/domain/auth_user.dart';
export 'features/auth/providers/auth_providers.dart' show authServiceProvider;
export 'shared/data/device_installation_repository.dart'
    show DeviceInstallationRepository;
export 'shared/providers/device_installation_providers.dart'
    show deviceInstallationRepositoryProvider;
