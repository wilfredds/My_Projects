import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';

/// Contract for bike + maintenance persistence.
abstract interface class BikesRepository {
  Stream<List<Bike>> watchBikes(String userId);

  Future<Result<Bike>> addBike(Bike bike);

  Future<Result<Bike>> updateBike(Bike bike);

  Future<Result<void>> deleteBike(String bikeId);

  /// Logs for one bike, scoped to [userId].
  ///
  /// The userId filter is NOT optional: Firestore evaluates read rules against
  /// a query's constraints and cannot filter, so a bikeId-only listen is
  /// rejected wholesale under owner-scoped rules.
  Stream<List<MaintenanceLog>> watchLogs(String userId, String bikeId);

  Future<Result<MaintenanceLog>> addLog(MaintenanceLog log);
}
