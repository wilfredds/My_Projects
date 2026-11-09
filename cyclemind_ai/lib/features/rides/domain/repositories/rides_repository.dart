import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/core/utils/write_ack.dart';
import 'package:cyclemind_ai/features/rides/domain/entities/ride.dart';

/// Contract for ride persistence.
///
/// WHY THIS INTERFACE OWNS THE ODOMETER: a ride and the bike mileage it
/// implies must move together or not at all. Firestore's atomicity boundary is
/// the batch, so the only way to get that guarantee is to issue both writes
/// from one place — here. The alternative, a use case doing two sequential
/// writes, trades a tidier layering diagram for a user-visible corrupt
/// odometer. There is deliberately NO standalone "add mileage" method
/// anywhere: one would be callable without a ride, which is precisely how a
/// double-count gets introduced later.
///
/// OFFLINE: writes succeed with [WriteAck.queued] when the server doesn't
/// answer in time. Firestore has then already applied them on this device and
/// delivers them on reconnect. They are never left waiting forever.
abstract interface class RidesRepository {
  /// Reactive stream of [userId]'s rides, newest first.
  Stream<List<Ride>> watchRides(String userId);

  Future<Result<List<Ride>>> getRides(String userId);

  /// Persists [ride] and applies its odometer effect as ONE atomic write.
  ///
  /// [Ride.odometerDeltaKm] must be non-null iff [Ride.bikeId] is non-null for
  /// a *newly logged* ride; a disagreement is a [ValidationFailure], never
  /// silently repaired.
  ///
  /// [Ride.id] MUST be caller-generated and STABLE ACROSS RETRIES. Re-sending
  /// the same id is rejected (firestore.rules denies `rides` update), which is
  /// what makes retrying an ambiguous timeout safe instead of double-counting.
  Future<Result<WriteAck>> addRide(Ride ride);

  /// Deletes [ride] and subtracts [Ride.odometerDeltaKm] in the same atomic
  /// write.
  ///
  /// Takes the ENTITY rather than an id on purpose: the delta to undo is
  /// carried by the ride. A ride written before odometer accounting carries
  /// null and so deletes without touching the odometer — which is what stops
  /// deleting a seeded ride from subtracting distance that was never added.
  ///
  /// A ride whose bike has since been deleted has no odometer left to credit,
  /// and is deleted alone. Implementations must CONFIRM the bike is gone
  /// before doing that. Never infer it from a failed write: a refusal can
  /// also mean the bike exists and the decrement was denied, and deleting
  /// the ride alone then would leave its km on that odometer for good.
  Future<Result<WriteAck>> deleteRide(Ride ride);
}
