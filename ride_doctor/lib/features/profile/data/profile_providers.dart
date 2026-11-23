import 'package:ride_doctor/core/app/environment.dart';
import 'package:ride_doctor/core/database/database_providers.dart';
import 'package:ride_doctor/features/profile/data/drift_garage_repository.dart';
import 'package:ride_doctor/features/profile/data/drift_rider_repository.dart';
import 'package:ride_doctor/features/profile/domain/bike.dart';
import 'package:ride_doctor/features/profile/domain/garage_repository.dart';
import 'package:ride_doctor/features/profile/domain/rider_profile.dart';
import 'package:ride_doctor/features/profile/domain/rider_repository.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'profile_providers.g.dart';

@Riverpod(keepAlive: true)
Future<RiderRepository> riderRepository(Ref ref) async => DriftRiderRepository(
  await ref.watch(appDatabaseProvider.future),
  clock: ref.watch(clockProvider),
  newId: ref.watch(idGeneratorProvider),
);

@Riverpod(keepAlive: true)
Future<GarageRepository> garageRepository(Ref ref) async =>
    DriftGarageRepository(
      await ref.watch(appDatabaseProvider.future),
      clock: ref.watch(clockProvider),
      newId: ref.watch(idGeneratorProvider),
    );

/// The rider profile, live. Its three states drive the whole app's startup:
/// loading (database opening), error (database unreadable), and data - where
/// null means "not onboarded yet".
@Riverpod(keepAlive: true)
Stream<RiderProfile?> riderProfile(Ref ref) async* {
  final repository = await ref.watch(riderRepositoryProvider.future);
  yield* repository.watchProfile();
}

@Riverpod(keepAlive: true)
Stream<Bike?> bike(Ref ref) async* {
  final repository = await ref.watch(garageRepositoryProvider.future);
  yield* repository.watchBike();
}

@Riverpod(keepAlive: true)
Stream<Set<SensorKind>> sensors(Ref ref) async* {
  final repository = await ref.watch(garageRepositoryProvider.future);
  yield* repository.watchSensors();
}
