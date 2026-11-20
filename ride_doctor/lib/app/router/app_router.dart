import 'package:go_router/go_router.dart';
import 'package:ride_doctor/features/dev/presentation/design_preview_screen.dart';
import 'package:ride_doctor/features/settings/presentation/settings_screen.dart';
import 'package:ride_doctor/features/today/presentation/today_screen.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'app_router.g.dart';

/// Every route path in one place, so screens navigate with
/// `context.go(AppRoutes.settings)` instead of repeating string literals that
/// the compiler cannot check.
abstract final class AppRoutes {
  static const today = '/';
  static const settings = '/settings';
  static const designPreview = '/settings/design-preview';
}

/// The router is a provider (not a global) so that later phases can make
/// redirects depend on app state - e.g. "send to onboarding until the profile
/// exists" - by reading other providers here.
@Riverpod(keepAlive: true)
GoRouter appRouter(Ref ref) {
  final router = GoRouter(
    routes: [
      GoRoute(
        path: AppRoutes.today,
        builder: (context, state) => const TodayScreen(),
        routes: [
          GoRoute(
            path: 'settings',
            builder: (context, state) => const SettingsScreen(),
            routes: [
              GoRoute(
                path: 'design-preview',
                builder: (context, state) => const DesignPreviewScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
}
