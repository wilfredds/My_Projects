import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/core/providers/firebase_providers.dart';
import 'package:cyclemind_ai/features/bikes/data/repositories/firebase_bikes_repository.dart';
import 'package:cyclemind_ai/features/bikes/data/repositories/mock_bikes_repository.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/repositories/bikes_repository.dart';
import 'package:cyclemind_ai/features/bikes/domain/usecases/generate_reminders.dart';
import 'package:cyclemind_ai/features/rides/presentation/controllers/rides_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Binds the [BikesRepository] implementation.
final bikesRepositoryProvider = Provider<BikesRepository>((ref) {
  if (AppConstants.useMocks) return MockBikesRepository();
  return FirebaseBikesRepository(ref.watch(firestoreProvider));
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
