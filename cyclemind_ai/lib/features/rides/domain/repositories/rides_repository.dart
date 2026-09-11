import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/features/rides/domain/entities/ride.dart';

/// Contract for ride persistence + retrieval.
abstract interface class RidesRepository {
  /// Reactive stream of the user's rides, newest first.
  Stream<List<Ride>> watchRides(String userId);

  Future<Result<List<Ride>>> getRides(String userId);

  Future<Result<Ride>> addRide(Ride ride);

  Future<Result<void>> deleteRide(String rideId);
}
