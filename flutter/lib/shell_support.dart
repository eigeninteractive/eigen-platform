/// Supported integration surface used by the optional first-party shell.
///
/// Game implementations should normally import `eigen_flutter.dart`. This
/// barrel exists so `eigen_shell` can consume reusable state and presentation
/// without deep-importing another package's implementation layout.
library;

export 'composition.dart' show EigenFlutterScope;
export 'core/adaptive/adaptive_layout.dart';
export 'core/analytics/analytics_provider.dart';
export 'core/analytics/analytics_service.dart';
export 'core/api/engine_api_providers.dart';
export 'core/config/app_config.dart';
export 'core/connectivity/connectivity_provider.dart';
export 'core/errors/error_messages.dart';
export 'core/game/game_module.dart';
export 'core/game/timing_constants.dart';
export 'core/licenses/bundled_font_licenses.dart';
export 'core/navigation/navigation_ports.dart';
export 'core/notifications/notification_provider.dart';
export 'core/notifications/notification_service.dart';
export 'core/storage/shared_preferences_provider.dart';
export 'core/storage/storage_provider.dart';
export 'core/theme/app_semantic_colors.dart';
export 'core/theme/app_theme.dart';
export 'features/auth/domain/auth_gateway.dart';
export 'features/auth/domain/auth_user.dart';
export 'features/auth/providers/auth_providers.dart';
export 'features/game/presentation/widgets/timer_builders.dart';
export 'features/game/providers/game_frame_provider.dart';
export 'features/game/providers/game_providers.dart';
export 'features/game/utils/bot_compatibility.dart';
export 'features/game/utils/game_timing.dart';
export 'shared/providers/player_providers.dart';
export 'shared/widgets/adaptive_single_choice.dart';
export 'shared/widgets/empty_state_view.dart';
export 'shared/widgets/overlapping_avatars.dart';
export 'shared/widgets/player_avatar.dart';
export 'shared/widgets/player_tags.dart';
export 'shared/widgets/status_banner.dart';
