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
    try {
      final batch = _db.batch();
      batch.delete(_db.collection(AppConstants.ridesCollection).doc(ride.id));
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
      // odometer left to credit back. Remove the ride alone rather than
      // leaving it permanently undeletable. Narrowed to not-found so a
      // permission error is never silently downgraded.
      if (e.code == 'not-found' && creditsBack) {
        try {
          await _db
              .collection(AppConstants.ridesCollection)
              .doc(ride.id)
              .delete();
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
}
