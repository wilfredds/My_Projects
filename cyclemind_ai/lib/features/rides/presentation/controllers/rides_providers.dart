import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/core/providers/firebase_providers.dart';
import 'package:cyclemind_ai/core/providers/sync_errors.dart';
import 'package:cyclemind_ai/features/auth/presentation/controllers/auth_controller.dart';
import 'package:cyclemind_ai/features/rides/data/repositories/firebase_rides_repository.dart';
import 'package:cyclemind_ai/features/rides/data/repositories/mock_rides_repository.dart';
import 'package:cyclemind_ai/features/rides/domain/entities/ride.dart';
import 'package:cyclemind_ai/features/rides/domain/repositories/rides_repository.dart';
import 'package:cyclemind_ai/features/rides/domain/usecases/log_ride.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Convenience: the signed-in user's id (empty when signed out).
final currentUserIdProvider = Provider<String>((ref) {
  return ref.watch(authStateProvider).valueOrNull?.id ?? '';
});

/// Binds the [RidesRepository] implementation.
final ridesRepositoryProvider = Provider<RidesRepository>((ref) {
  if (AppConstants.useMocks) return MockRidesRepository();
  return FirebaseRidesRepository(
    ref.watch(firestoreProvider),
    // A write reported as saved offline and later rejected by the server is
    // rolled back silently; this is how the rider hears about it.
    onLateFailure: ref.watch(syncErrorsProvider).report,
  );
});

/// Reactive list of the current user's logged rides.
///
/// Rides are an odometer feeding maintenance reminders — not a training log.
/// Ride *recording* is deliberately left to Strava/Garmin; see the pivot plan.
final ridesStreamProvider = StreamProvider<List<Ride>>((ref) {
  final userId = ref.watch(currentUserIdProvider);
  if (userId.isEmpty) return const Stream.empty();
  return ref.watch(ridesRepositoryProvider).watchRides(userId);
});

/// Logs a ride and advances its bike's odometer, atomically.
final logRideProvider = Provider<LogRide>(
    (ref) => LogRide(ref.watch(ridesRepositoryProvider)));

/// Deletes a ride, crediting back exactly what it added.
final deleteRideProvider = Provider<DeleteRide>(
    (ref) => DeleteRide(ref.watch(ridesRepositoryProvider)));
