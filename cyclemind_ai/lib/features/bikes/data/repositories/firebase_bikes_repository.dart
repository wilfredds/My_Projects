import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/core/error/failures.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/core/utils/write_ack.dart';
import 'package:cyclemind_ai/features/bikes/data/models/bike_model.dart';
import 'package:cyclemind_ai/features/bikes/data/models/maintenance_log_model.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/domain/repositories/bikes_repository.dart';

/// Firestore-backed [BikesRepository].
class FirebaseBikesRepository implements BikesRepository {
  FirebaseBikesRepository(
    this._db, {
    void Function(String message)? onLateFailure,
  }) : _onLateFailure = onLateFailure;

  final FirebaseFirestore _db;

  /// Told when a write reported as saved offline is later rejected by the
  /// server, which rolls it back on the device silently.
  final void Function(String message)? _onLateFailure;

  void Function(Object) _late(String message) =>
      (_) => _onLateFailure?.call(message);

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
  Future<Result<WriteAck>> addBike(Bike bike) async {
    if (bike.id.isEmpty) {
      return Failure(const ValidationFailure('A bike needs an id.'));
    }
    try {
      // doc(bike.id).set, not .add(): .add() minted a new id per call, so a
      // second tap (easy offline, where nothing seemed to happen) queued a
      // duplicate bike. A repeat now rewrites the same document, which the
      // rules allow as an owner update.
      final ack = await awaitServerAck(
        _bikes.doc(bike.id).set(BikeModel.toMap(bike)),
        onLateFailure:
            _late("Couldn't sync a bike you added offline, so it was removed."),
      );
      return Success(ack);
    } catch (_) {
      return Failure(const ServerFailure('Could not save the bike.'));
    }
  }

  @override
  Future<Result<WriteAck>> setComponents(
    String bikeId,
    List<BikeComponent> components,
  ) async {
    try {
      // Field-scoped update: `totalMileageKm` is absent from the payload, so
      // the stored value carries through untouched. There is no follow-up
      // read: nothing used it, and offline it was a second thing to wait on.
      final ack = await awaitServerAck(
        _bikes.doc(bikeId).update(
          {'components': BikeModel.componentsToMaps(components)},
        ),
        onLateFailure: _late(
            "Couldn't sync a change to your parts made offline, so it was undone."),
      );
      return Success(ack);
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
  Future<Result<WriteAck>> replaceComponent({
    required Bike bike,
    required BikeComponent replacement,
    required MaintenanceLog log,
  }) async {
    final violation = replacementContractViolation(
        bike: bike, replacement: replacement, log: log);
    if (violation != null) return Failure(ValidationFailure(violation));

    try {
      final batch = _db.batch()
        // doc(log.id).set and never .add(): the client id is load-bearing.
        // Logs are create-only, so a retry is evaluated as a denied update
        // instead of writing a second history entry.
        ..set(_logs.doc(log.id), MaintenanceLogModel.toMap(log))
        // Field-scoped: totalMileageKm is absent, so the stored odometer
        // carries through even if [bike] is a stale snapshot.
        ..update(_bikes.doc(bike.id), {
          'components': BikeModel.componentsToMaps(
              replaceById(bike.components, replacement)),
        });
      final ack = await awaitServerAck(
        batch.commit(),
        onLateFailure: _late(
            "Couldn't sync a replacement you recorded offline, so it was undone."),
      );
      return Success(ack);
    } catch (_) {
      return Failure(const ServerFailure('Could not record the replacement.'));
    }
  }
}
