import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/core/error/failures.dart';
import 'package:cyclemind_ai/core/providers/mock_store.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/core/utils/write_ack.dart';
import 'package:cyclemind_ai/features/rides/domain/entities/ride.dart';
import 'package:cyclemind_ai/features/rides/domain/repositories/rides_repository.dart';

/// In-memory [RidesRepository] over the shared [MockStore].
///
/// This mock deliberately reproduces every denial the Firestore rules enforce
/// — duplicate ride id, missing bike, odometer out of range. A lenient mock is
/// how a demo passes while production fails, which is the exact failure mode
/// that produced the bugs this change fixes.
class MockRidesRepository implements RidesRepository {
  List<Ride> _ridesFor(String userId) =>
      [...MockStore.instance.rides.where((r) => r.userId == userId)]
        ..sort((a, b) => b.startedAt.compareTo(a.startedAt));

  @override
  Stream<List<Ride>> watchRides(String userId) async* {
    await MockStore.instance.ensureLoaded();
    yield _ridesFor(userId);
    // Re-filter per subscriber rather than pushing a pre-filtered list onto a
    // shared controller: two users can be watching at once.
    yield* MockStore.instance.changes.map((_) => _ridesFor(userId));
  }

  @override
  Future<Result<List<Ride>>> getRides(String userId) async {
    await MockStore.instance.ensureLoaded();
    return Success(_ridesFor(userId));
  }

  @override
  Future<Result<WriteAck>> addRide(Ride ride) async {
    await MockStore.instance.ensureLoaded();
    final store = MockStore.instance;
    final delta = ride.odometerDeltaKm;

    if ((ride.bikeId == null) != (delta == null)) {
      return Failure(const ValidationFailure(
          'A ride must record a delta for its bike, and none without one.'));
    }
    // Mirrors firestore.rules denying `rides` update: a retry of the same id
    // must not apply the odometer twice.
    if (store.rides.any((r) => r.id == ride.id)) {
      return Failure(const ValidationFailure('That ride was already saved.'));
    }

    final bikeIndex =
        ride.bikeId == null ? -1 : store.bikes.indexWhere((b) => b.id == ride.bikeId);
    if (ride.bikeId != null && bikeIndex < 0) {
      return Failure(const ValidationFailure('That bike no longer exists.'));
    }

    if (bikeIndex >= 0 && delta != null) {
      final after = store.bikes[bikeIndex].totalMileageKm + delta;
      if (after < 0 || after > AppConstants.maxOdometerKm) {
        return Failure(const ValidationFailure(
            'That ride would put the bike\'s odometer out of range.'));
      }
    }

    store.commit((s) {
      s.rides.add(ride);
      if (bikeIndex >= 0 && delta != null) {
        s.bikes[bikeIndex] = s.bikes[bikeIndex].copyWith(
          totalMileageKm: s.bikes[bikeIndex].totalMileageKm + delta,
        );
      }
    });
    // In memory, so every write is confirmed at once.
    return const Success(WriteAck.confirmed);
  }

  @override
  Future<Result<WriteAck>> deleteRide(Ride ride) async {
    await MockStore.instance.ensureLoaded();
    final store = MockStore.instance;
    final delta = ride.odometerDeltaKm;
    final bikeIndex =
        ride.bikeId == null ? -1 : store.bikes.indexWhere((b) => b.id == ride.bikeId);

    store.commit((s) {
      s.rides.removeWhere((r) => r.id == ride.id);
      // Only credit back what this ride actually added. A seeded or legacy
      // ride carries a null delta and leaves the odometer alone.
      if (bikeIndex >= 0 && delta != null && delta != 0) {
        final after = s.bikes[bikeIndex].totalMileageKm - delta;
        s.bikes[bikeIndex] = s.bikes[bikeIndex].copyWith(
          totalMileageKm: after < 0 ? 0 : after,
        );
      }
    });
    return const Success(WriteAck.confirmed);
  }
}
