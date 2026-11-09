import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';

/// Contract for bike + maintenance persistence.
abstract interface class BikesRepository {
  Stream<List<Bike>> watchBikes(String userId);

  Future<Result<Bike>> addBike(Bike bike);

  /// Replaces a bike's tracked components.
  ///
  /// Deliberately CANNOT touch `totalMileageKm`. The previous `updateBike`
  /// wrote the whole document from a possibly-stale snapshot, so adding a
  /// component silently rolled the odometer back to whatever the screen last
  /// read. Narrowing the interface makes that impossible by construction
  /// rather than by convention: only logging or deleting a ride moves the
  /// odometer.
  Future<Result<Bike>> setComponents(String bikeId, List<BikeComponent> components);

  Future<Result<void>> deleteBike(String bikeId);

  /// Logs for one bike, scoped to [userId].
  ///
  /// The userId filter is NOT optional: Firestore evaluates read rules against
  /// a query's constraints and cannot filter, so a bikeId-only listen is
  /// rejected wholesale under owner-scoped rules.
  Stream<List<MaintenanceLog>> watchLogs(String userId, String bikeId);

  Future<Result<MaintenanceLog>> addLog(MaintenanceLog log);
}
