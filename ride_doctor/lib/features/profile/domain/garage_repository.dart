import 'package:ride_doctor/features/profile/domain/bike.dart';

/// Stores the rider's bike, its drivetrain and their sensors.
abstract interface class GarageRepository {
  /// The rider's bike (the first one added); null if none yet.
  Stream<Bike?> watchBike();

  /// Inserts or updates [bike] by id, including its drivetrain.
  Future<void> saveBike(Bike bike);

  Stream<Set<SensorKind>> watchSensors();

  /// Makes the stored sensors exactly [kinds].
  Future<void> setSensors(Set<SensorKind> kinds);
}
