import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:ride_doctor/app/router/app_shell.dart';
import 'package:ride_doctor/app/startup/startup_screens.dart';
import 'package:ride_doctor/features/calculators/presentation/my_numbers_screen.dart';
import 'package:ride_doctor/features/dev/presentation/design_preview_screen.dart';
import 'package:ride_doctor/features/onboarding/presentation/onboarding_screen.dart';
import 'package:ride_doctor/features/profile/data/profile_providers.dart';
import 'package:ride_doctor/features/profile/presentation/edit_bike_screen.dart';
import 'package:ride_doctor/features/profile/presentation/edit_rider_screen.dart';
import 'package:ride_doctor/features/profile/presentation/profile_screen.dart';
import 'package:ride_doctor/features/settings/presentation/privacy_screen.dart';
import 'package:ride_doctor/features/settings/presentation/settings_screen.dart';
import 'package:ride_doctor/features/today/presentation/today_screen.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'app_router.g.dart';

/// Every route path in one place, so screens navigate with
/// `context.go(AppRoutes.settings)` instead of repeating string literals that
/// the compiler cannot check.
abstract final class AppRoutes {
  static const starting = '/starting';
  static const startupError = '/startup-error';
  static const onboarding = '/onboarding';

  static const today = '/';
  static const numbers = '/numbers';
  static const profile = '/profile';

  static const editRider = '/edit-rider';
  static const editBike = '/edit-bike';
  static const settings = '/settings';
  static const privacy = '/settings/privacy';
  static const designPreview = '/settings/design-preview';
}

/// Where the rider should be, given what state the app is in. Returns null
/// when [location] is already fine.
///
/// The rider-profile stream is the single source of truth for app state:
///   still loading        -> the database is opening      -> starting screen
///   failed               -> the database is unreadable   -> error screen
///   loaded, no profile   -> first run                    -> onboarding
///   loaded, has profile  -> the app proper
///
/// A top-level pure function so each of those rules is unit-tested without
/// building any widgets.
String? redirectFor({
  required String location,
  required bool loading,
  required bool failed,
  required bool hasProfile,
}) {
  const gates = {
    AppRoutes.starting,
    AppRoutes.startupError,
    AppRoutes.onboarding,
  };
  final target = loading
      ? AppRoutes.starting
      : failed
      ? AppRoutes.startupError
      : !hasProfile
      ? AppRoutes.onboarding
      : null;
  if (target != null) return location == target ? null : target;
  // Ready: only leave the gate screens; anywhere else is a real destination.
  return gates.contains(location) ? AppRoutes.today : null;
}

/// The router is a provider (not a global) so its redirects can depend on app
/// state by reading other providers.
@Riverpod(keepAlive: true)
GoRouter appRouter(Ref ref) {
  // go_router re-runs `redirect` whenever this notifier fires. We fire it
  // each time the profile changes state, which is what moves the rider from
  // the starting screen into onboarding, and from onboarding into the app.
  final refresh = ValueNotifier(0);
  ref
    ..listen(riderProfileProvider, (_, _) => refresh.value++)
    ..onDispose(refresh.dispose);

  final router = GoRouter(
    refreshListenable: refresh,
    redirect: (context, state) {
      final profile = ref.read(riderProfileProvider);
      return redirectFor(
        location: state.matchedLocation,
        loading: profile.isLoading && !profile.hasValue,
        failed: profile.hasError && !profile.hasValue,
        hasProfile: profile.value != null,
      );
    },
    routes: [
      GoRoute(
        path: AppRoutes.starting,
        builder: (context, state) => const StartingScreen(),
      ),
      GoRoute(
        path: AppRoutes.startupError,
        builder: (context, state) => const StartupErrorScreen(),
      ),
      GoRoute(
        path: AppRoutes.onboarding,
        builder: (context, state) => const OnboardingScreen(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.today,
                builder: (context, state) => const TodayScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.numbers,
                builder: (context, state) => const MyNumbersScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: AppRoutes.profile,
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
      // Full-screen pages pushed over the tabs (no bottom bar while editing).
      GoRoute(
        path: AppRoutes.editRider,
        builder: (context, state) => const EditRiderScreen(),
      ),
      GoRoute(
        path: AppRoutes.editBike,
        builder: (context, state) => const EditBikeScreen(),
      ),
      GoRoute(
        path: AppRoutes.settings,
        builder: (context, state) => const SettingsScreen(),
        routes: [
          GoRoute(
            path: 'privacy',
            builder: (context, state) => const PrivacyScreen(),
          ),
          GoRoute(
            path: 'design-preview',
            builder: (context, state) => const DesignPreviewScreen(),
          ),
        ],
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
}
