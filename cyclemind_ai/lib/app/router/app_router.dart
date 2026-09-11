import 'package:cyclemind_ai/features/auth/presentation/controllers/auth_controller.dart';
import 'package:cyclemind_ai/features/auth/presentation/screens/login_screen.dart';
import 'package:cyclemind_ai/features/auth/presentation/screens/signup_screen.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/presentation/screens/add_bike_screen.dart';
import 'package:cyclemind_ai/features/bikes/presentation/screens/bike_detail_screen.dart';
import 'package:cyclemind_ai/features/bike_doctor/presentation/screens/mechanic_chat_screen.dart';
import 'package:cyclemind_ai/features/rides/presentation/screens/add_ride_screen.dart';
import 'package:cyclemind_ai/features/dashboard/presentation/screens/home_shell.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Centralised navigation.
///
/// Architectural decision: `go_router`'s `redirect` reads the [authStateProvider]
/// so auth gating lives in one place — signed-out users are bounced to `/login`,
/// signed-in users away from the auth screens. `refreshListenable` keeps the
/// router in sync with auth changes.
final goRouterProvider = Provider<GoRouter>((ref) {
  // Built once. Auth state is read *freshly* inside redirect, and
  // refreshListenable re-runs redirect whenever auth changes — so we never
  // rebuild the GoRouter itself (which would drop navigation state).
  return GoRouter(
    initialLocation: '/home',
    refreshListenable: _AuthRefresh(ref),
    redirect: (context, state) {
      final loggedIn = ref.read(authStateProvider).valueOrNull != null;
      final loggingIn =
          state.matchedLocation == '/login' || state.matchedLocation == '/signup';
      if (!loggedIn) return loggingIn ? null : '/login';
      if (loggingIn) return '/home';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/signup', builder: (_, __) => const SignupScreen()),
      GoRoute(path: '/home', builder: (_, __) => const HomeShell()),
      GoRoute(path: '/rides/new', builder: (_, __) => const AddRideScreen()),
      GoRoute(path: '/bikes/new', builder: (_, __) => const AddBikeScreen()),
      GoRoute(
        path: '/bikes/detail',
        builder: (_, state) => BikeDetailScreen(bike: state.extra! as Bike),
      ),
      GoRoute(path: '/chat', builder: (_, __) => const MechanicChatScreen()),
    ],
  );
});

/// Bridges a Riverpod provider to a [Listenable] for go_router refresh.
class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(Ref ref) {
    ref.listen(authStateProvider, (_, __) => notifyListeners());
  }
}
