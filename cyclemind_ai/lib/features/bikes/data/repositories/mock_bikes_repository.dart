import 'package:cyclemind_ai/core/error/failures.dart';
import 'package:cyclemind_ai/core/providers/mock_store.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/domain/repositories/bikes_repository.dart';

/// In-memory [BikesRepository] over the shared [MockStore].
///
/// Every read filters on `userId`. The store is process-wide, so a method that
/// ignored its `userId` argument would show one user another user's garage.
class MockBikesRepository implements BikesRepository {
  List<Bike> _bikesFor(String userId) =>
      MockStore.instance.bikes.where((b) => b.userId == userId).toList();

  List<MaintenanceLog> _logsFor(String userId, String bikeId) => MockStore
      .instance.logs
      .where((l) => l.userId == userId && l.bikeId == bikeId)
      .toList()
    ..sort((a, b) => b.serviceDate.compareTo(a.serviceDate));

  @override
  Stream<List<Bike>> watchBikes(String userId) async* {
    await MockStore.instance.ensureLoaded();
    yield _bikesFor(userId);
    yield* MockStore.instance.changes.map((_) => _bikesFor(userId));
  }

  @override
  Future<Result<Bike>> addBike(Bike bike) async {
    await MockStore.instance.ensureLoaded();
    MockStore.instance.commit((s) => s.bikes.add(bike));
    return Success(bike);
  }

  @override
  Future<Result<Bike>> setComponents(
    String bikeId,
    List<BikeComponent> components,
  ) async {
    await MockStore.instance.ensureLoaded();
    final store = MockStore.instance;
    final i = store.bikes.indexWhere((b) => b.id == bikeId);
    if (i < 0) {
      return Failure(const ValidationFailure('That bike no longer exists.'));
    }
    // copyWith leaves totalMileageKm alone, mirroring the field-scoped
    // Firestore update.
    late Bike updated;
    store.commit((s) {
      updated = s.bikes[i].copyWith(components: components);
      s.bikes[i] = updated;
    });
    return Success(updated);
  }

  @override
  Future<Result<void>> deleteBike(String bikeId) async {
    await MockStore.instance.ensureLoaded();
    MockStore.instance.commit((s) => s.bikes.removeWhere((b) => b.id == bikeId));
    return const Success(null);
  }

  @override
  Stream<List<MaintenanceLog>> watchLogs(String userId, String bikeId) async* {
    await MockStore.instance.ensureLoaded();
    yield _logsFor(userId, bikeId);
    yield* MockStore.instance.changes.map((_) => _logsFor(userId, bikeId));
  }

  @override
  Future<Result<MaintenanceLog>> addLog(MaintenanceLog log) async {
    await MockStore.instance.ensureLoaded();
    MockStore.instance.commit((s) => s.logs.add(log));
    return Success(log);
  }
}
