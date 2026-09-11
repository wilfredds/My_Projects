import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/core/error/failures.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/features/rides/data/models/ride_model.dart';
import 'package:cyclemind_ai/features/rides/domain/entities/ride.dart';
import 'package:cyclemind_ai/features/rides/domain/repositories/rides_repository.dart';

/// Firestore-backed [RidesRepository].
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
    try {
      final ref = await _db
          .collection(AppConstants.ridesCollection)
          .add(RideModel.toMap(ride));
      return Success(ride.copyWith(id: ref.id));
    } catch (_) {
      return Failure(const ServerFailure());
    }
  }

  @override
  Future<Result<void>> deleteRide(String rideId) async {
    try {
      await _db
          .collection(AppConstants.ridesCollection)
          .doc(rideId)
          .delete();
      return const Success(null);
    } catch (_) {
      return Failure(const ServerFailure());
    }
  }
}
