import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/core/error/failures.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/features/bikes/data/models/bike_model.dart';
import 'package:cyclemind_ai/features/bikes/data/models/maintenance_log_model.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/domain/repositories/bikes_repository.dart';

/// Firestore-backed [BikesRepository].
class FirebaseBikesRepository implements BikesRepository {
  FirebaseBikesRepository(this._db);
  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> get _bikes =>
      _db.collection(AppConstants.bikesCollection);
  CollectionReference<Map<String, dynamic>> get _logs =>
      _db.collection(AppConstants.maintenanceLogsCollection);

  @override
  Stream<List<Bike>> watchBikes(String userId) {
    return _bikes.where('userId', isEqualTo: userId).snapshots().map((snap) =>
        snap.docs.map((d) => BikeModel.fromMap(d.id, d.data())).toList());
  }

  @override
  Future<Result<Bike>> addBike(Bike bike) async {
    try {
      final ref = await _bikes.add(BikeModel.toMap(bike));
      return Success(bike.copyWith(id: ref.id));
    } catch (_) {
      return Failure(const ServerFailure());
    }
  }

  @override
  Future<Result<Bike>> setComponents(
    String bikeId,
    List<BikeComponent> components,
  ) async {
    try {
      // Field-scoped update: `totalMileageKm` is absent from the payload, so
      // the stored value carries through untouched.
      await _bikes.doc(bikeId).update(
        {'components': BikeModel.componentsToMaps(components)},
      );
      final snap = await _bikes.doc(bikeId).get();
      return Success(BikeModel.fromMap(bikeId, snap.data() ?? const {}));
    } catch (_) {
      return Failure(const ServerFailure('Could not update the components.'));
    }
  }

  @override
  Future<Result<void>> deleteBike(String bikeId) async {
    try {
      await _bikes.doc(bikeId).delete();
      return const Success(null);
    } catch (_) {
      return Failure(const ServerFailure());
    }
  }

  @override
  Stream<List<MaintenanceLog>> watchLogs(String userId, String bikeId) {
    return _logs
        .where('userId', isEqualTo: userId)
        .where('bikeId', isEqualTo: bikeId)
        .orderBy('serviceDate', descending: true)
        .snapshots()
        .map((snap) => snap.docs
            .map((d) => MaintenanceLogModel.fromMap(d.id, d.data()))
            .toList());
  }

  @override
  Future<Result<MaintenanceLog>> addLog(MaintenanceLog log) async {
    try {
      final ref = await _logs.add(MaintenanceLogModel.toMap(log));
      return Success(log.copyWith(id: ref.id));
    } catch (_) {
      return Failure(const ServerFailure());
    }
  }
}
