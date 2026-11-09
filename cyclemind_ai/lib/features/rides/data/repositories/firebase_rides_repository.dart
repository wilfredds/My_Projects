import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/core/error/failures.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/features/rides/data/models/ride_model.dart';
import 'package:cyclemind_ai/features/rides/domain/entities/ride.dart';
import 'package:cyclemind_ai/features/rides/domain/repositories/rides_repository.dart';

/// Firestore-backed [RidesRepository].
///
/// The ride write and the odometer increment go in a single [WriteBatch], so
/// they commit together or not at all — there is no partial state to
/// compensate for.
///
/// `FieldValue.increment` rather than read-modify-write: it needs no read, it
/// is commutative (two devices both count), and crucially it works OFFLINE,
/// which `runTransaction` does not. A cycling app logs rides where there is no
/// signal. Security rules see the *computed* result, so the
/// `numIn(d.totalMileageKm, 0, 500000)` bound still applies — verified in
/// firestore-tests/premise.test.js.
class FirebaseRidesRepository implements RidesRepository {
  FirebaseRidesRepository(this._db);
  final FirebaseFirestore _db;

  Query<Map<String, dynamic>> _userRides(String userId) => _db
      .collection(AppConstants.ridesCollection)
      .where('userId', isEqualTo: userId)
      .orderBy('startedAt', descending: true);

  @override
  Stream<List<Ride>> watchRides(String userId) {
    return _userRides(userId).snapshots().map((snap) =>
        snap.docs.map((d) => RideModel.fromMap(d.id, d.data())).toList());
  }

  @override
  Future<Result<List<Ride>>> getRides(String userId) async {
    try {
      final snap = await _userRides(userId).get();
      return Success(
          snap.docs.map((d) => RideModel.fromMap(d.id, d.data())).toList());
    } catch (_) {
      return Failure(const ServerFailure());
    }
  }

  @override
  Future<Result<Ride>> addRide(Ride ride) async {
    final delta = ride.odometerDeltaKm;
    if ((ride.bikeId == null) != (delta == null)) {
      return Failure(const ValidationFailure(
          'A ride must record a delta for its bike, and none without one.'));
    }
    try {
      final batch = _db.batch();
      // doc(ride.id).set rather than .add: the client id is load-bearing, it
      // is what makes a retry a denied update instead of a second increment.
      batch.set(
        _db.collection(AppConstants.ridesCollection).doc(ride.id),
        RideModel.toMap(ride),
      );
      if (delta != null && delta != 0) {
        batch.update(
          _db.collection(AppConstants.bikesCollection).doc(ride.bikeId!),
          {'totalMileageKm': FieldValue.increment(delta)},
        );
      }
      await batch.commit();
      return Success(ride);
    } catch (_) {
      return Failure(const ServerFailure('Could not save the ride.'));
    }
  }

  @override
  Future<Result<void>> deleteRide(Ride ride) async {
    final delta = ride.odometerDeltaKm;
    final creditsBack = ride.bikeId != null && delta != null && delta != 0;
    final rideRef = _db.collection(AppConstants.ridesCollection).doc(ride.id);
    try {
      final batch = _db.batch()..delete(rideRef);
      if (creditsBack) {
        batch.update(
          _db.collection(AppConstants.bikesCollection).doc(ride.bikeId!),
          {'totalMileageKm': FieldValue.increment(-delta)},
        );
      }
      await batch.commit();
      return const Success(null);
    } on FirebaseException catch (e) {
      // The bike was deleted after this ride was logged, so there is no
      // odometer left to credit back. The batch's bike update is then DENIED,
      // not not-found: the rules evaluate `update` against a null `resource`,
      // ownsStored() errors, and the whole batch is rejected
      // (firestore-tests/premise.test.js C10a). This used to wait for
      // not-found, which never came, so such a ride could never be deleted.
      //
      // permission-denied also covers real refusals, such as a decrement
      // that would take the odometer below zero (C6). So delete the ride alone
      // only once the server confirms the bike is gone. Otherwise its km
      // would stay on a bike that still exists, silently and for good (C10d).
      if (creditsBack &&
          e.code == 'permission-denied' &&
          await _bikeIsGone(ride)) {
        try {
          await rideRef.delete();
          return const Success(null);
        } catch (_) {
          return Failure(const ServerFailure('Could not delete the ride.'));
        }
      }
      return Failure(const ServerFailure('Could not delete the ride.'));
    } catch (_) {
      return Failure(const ServerFailure('Could not delete the ride.'));
    }
  }

  /// True only when the SERVER confirms that [ride]'s bike no longer exists.
  ///
  /// A direct `get()` can't answer this: the rules deny reading a deleted
  /// bike exactly as they deny reading someone else's (C10b). The owner's own
  /// bikes query is allowed, and a bike missing from it is gone. Read from
  /// the server, never the cache, which may still hold the deleted bike. Any
  /// failure answers false: when in doubt, refuse the delete rather than
  /// drop the odometer credit.
  Future<bool> _bikeIsGone(Ride ride) async {
    try {
      final mine = await _db
          .collection(AppConstants.bikesCollection)
          .where('userId', isEqualTo: ride.userId)
          .get(const GetOptions(source: Source.server));
      return mine.docs.every((d) => d.id != ride.bikeId);
    } catch (_) {
      return false;
    }
  }
}
