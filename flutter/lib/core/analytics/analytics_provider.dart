import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:eigen_flutter/core/analytics/analytics_service.dart';

part 'analytics_provider.g.dart';

/// Application-wide [AnalyticsService] instance.
@Riverpod(keepAlive: true)
AnalyticsService analyticsService(Ref ref) => const NoopAnalyticsService();
