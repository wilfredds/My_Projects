import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/core/providers/firebase_providers.dart';
import 'package:cyclemind_ai/core/providers/sync_errors.dart';
import 'package:cyclemind_ai/features/bikes/data/repositories/firebase_bikes_repository.dart';
import 'package:cyclemind_ai/features/bikes/data/repositories/mock_bikes_repository.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/domain/repositories/bikes_repository.dart';
import 'package:cyclemind_ai/features/bikes/domain/usecases/generate_reminders.dart';
import 'package:cyclemind_ai/features/bikes/domain/usecases/replace_component.dart';
import 'package:cyclemind_ai/features/rides/presentation/controllers/rides_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Binds the [BikesRepository] implementation.
final bikesRepositoryProvider = Provider<BikesRepository>((ref) {
  if (AppConstants.useMocks) return MockBikesRepository();
  return FirebaseBikesRepository(
    ref.watch(firestoreProvider),
    // A write reported as saved offline and later rejected by the server is
    // rolled back silently; this is how the rider hears about it.
    onLateFailure: ref.watch(syncErrorsProvider).report,
  );
});

/// Reactive list of the current user's bikes.
final bikesStreamProvider = StreamProvider<List<Bike>>((ref) {
  final userId = ref.watch(currentUserIdProvider);
  if (userId.isEmpty) return const Stream.empty();
  return ref.watch(bikesRepositoryProvider).watchBikes(userId);
});

/// Maintenance reminders derived from current bike/component wear.
final remindersProvider = Provider<List<MaintenanceReminder>>((ref) {
  final bikes = ref.watch(bikesStreamProvider).valueOrNull ?? const [];
  return const GenerateReminders().call(bikes);
});

/// Bike id -> display name, for labelling rides.
///
/// Lives here rather than in rides_providers because this file already imports
/// that one (for [currentUserIdProvider]); the reverse direction would be an
/// import cycle.
final bikeNamesProvider = Provider<Map<String, String>>((ref) {
  final bikes = ref.watch(bikesStreamProvider).valueOrNull ?? const [];
  return {for (final b in bikes) b.id: b.name};
});

/// Records a replacement: resets the part's wear and appends a service-history
/// entry, atomically.
final replaceComponentProvider = Provider<ReplaceComponent>(
    (ref) => ReplaceComponent(ref.watch(bikesRepositoryProvider)));

/// One bike's service history, newest first.
///
/// autoDispose + family: one listener per bike screen that is actually open.
/// Without autoDispose, every bike ever opened would keep a live Firestore
/// listener for the rest of the session.
final maintenanceLogsProvider = StreamProvider.autoDispose
    .family<List<MaintenanceLog>, String>((ref, bikeId) {
  final userId = ref.watch(currentUserIdProvider);
  if (userId.isEmpty) return const Stream.empty();
  return ref.watch(bikesRepositoryProvider).watchLogs(userId, bikeId);
});
