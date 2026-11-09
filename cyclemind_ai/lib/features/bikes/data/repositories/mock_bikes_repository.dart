import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/core/error/failures.dart';
import 'package:cyclemind_ai/core/providers/mock_store.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/domain/repositories/bikes_repository.dart';

/// In-memory [BikesRepository] over the shared [MockStore].
///
/// Every read filters on `userId`. The store is process-wide, so a method that
/// ignored its `userId` argument would show one user another user's garage.
///
/// Writes reproduce the denials firestore.rules enforces. A lenient mock is how
/// a demo passes while production fails.
class MockBikesRepository implements BikesRepository {
  List<Bike> _bikesFor(String userId) =>
      MockStore.instance.bikes.where((b) => b.userId == userId).toList();

  List<MaintenanceLog> _logsFor(String userId, String bikeId) => MockStore
      .instance.logs
      .where((l) => l.userId == userId && l.bikeId == bikeId)
      .toList()
    ..sort((a, b) => b.serviceDate.compareTo(a.serviceDate));

  @override
  Stream<List<Bike>> watchBikes(String userId) async* {
    await MockStore.instance.ensureLoaded();
    yield _bikesFor(userId);
    yield* MockStore.instance.changes.map((_) => _bikesFor(userId));
  }

  @override
  Future<Result<Bike>> addBike(Bike bike) async {
    await MockStore.instance.ensureLoaded();
    MockStore.instance.commit((s) => s.bikes.add(bike));
    return Success(bike);
  }

  @override
  Future<Result<Bike>> setComponents(
    String bikeId,
    List<BikeComponent> components,
  ) async {
    await MockStore.instance.ensureLoaded();
    final store = MockStore.instance;
    final i = store.bikes.indexWhere((b) => b.id == bikeId);
    if (i < 0) {
      return Failure(const ValidationFailure('That bike no longer exists.'));
    }
    // Mirrors `d.components.size() <= 60` on bikes.
    if (components.length > AppConstants.maxComponentsPerBike) {
      return Failure(const ValidationFailure(
          'A bike can track at most ${AppConstants.maxComponentsPerBike} '
          'components.'));
    }
    // copyWith leaves totalMileageKm alone, mirroring the field-scoped
    // Firestore update.
    late Bike updated;
    store.commit((s) {
      updated = s.bikes[i].copyWith(components: components);
      s.bikes[i] = updated;
    });
    return Success(updated);
  }

  @override
  Future<Result<void>> deleteBike(String bikeId) async {
    await MockStore.instance.ensureLoaded();
    MockStore.instance.commit((s) => s.bikes.removeWhere((b) => b.id == bikeId));
    return const Success(null);
  }

  @override
  Stream<List<MaintenanceLog>> watchLogs(String userId, String bikeId) async* {
    await MockStore.instance.ensureLoaded();
    yield _logsFor(userId, bikeId);
    yield* MockStore.instance.changes.map((_) => _logsFor(userId, bikeId));
  }

  /// One commit for the log AND the reset, after every check has passed, so
  /// a denial leaves nothing behind. That is the same all-or-nothing
  /// behaviour a Firestore batch has.
  @override
  Future<Result<void>> replaceComponent({
    required Bike bike,
    required BikeComponent replacement,
    required MaintenanceLog log,
  }) async {
    await MockStore.instance.ensureLoaded();
    // Everything from here to commit() is synchronous, so nothing can change
    // the store between the checks and the write.
    final store = MockStore.instance;

    final violation = replacementContractViolation(
        bike: bike, replacement: replacement, log: log);
    if (violation != null) return Failure(ValidationFailure(violation));

    // signedIn() / ownsIncoming(): the mock has no auth context, so a log must
    // at least name an owner, and that owner must own the stored bike.
    if (log.userId.isEmpty) {
      return Failure(const ValidationFailure('You need to be signed in.'));
    }
    // maintenance_logs `allow update: if false` — a retry of the same id is
    // denied, not recorded twice.
    if (store.logs.any((l) => l.id == log.id)) {
      return Failure(
          const ValidationFailure('That replacement was already recorded.'));
    }
    // bikes ownsStored(): missing and foreign bikes are both denied.
    final i = store.bikes.indexWhere((b) => b.id == bike.id);
    if (i < 0 || store.bikes[i].userId != log.userId) {
      return Failure(const ValidationFailure('That bike no longer exists.'));
    }

    final logProblem = _logShapeViolation(log);
    if (logProblem != null) return Failure(ValidationFailure(logProblem));

    // The odometer comes from the STORE, never from the caller's snapshot,
    // mirroring the field-scoped Firestore update. The components array is
    // written wholesale from the snapshot, exactly as the real batch does.
    final after = store.bikes[i]
        .copyWith(components: replaceById(bike.components, replacement));
    if (after.components.length > AppConstants.maxComponentsPerBike) {
      return Failure(const ValidationFailure(
          'A bike can track at most ${AppConstants.maxComponentsPerBike} '
          'components.'));
    }

    store.commit((s) {
      s.bikes[i] = after;
      s.logs.add(log);
    });
    return const Success(null);
  }

  /// The `logShapeOk` clauses a well-formed client could still trip, each
  /// naming the rule it copies. Written so that NaN fails every numeric check:
  /// `!(v >= lo && v <= hi)` is true for NaN, whereas `v < lo || v > hi` is
  /// false.
  String? _logShapeViolation(MaintenanceLog log) {
    if (log.bikeId.isEmpty || log.bikeId.length > 200) {
      return 'That service entry has no valid bike.'; // str(d.bikeId, 200)
    }
    if (log.component.length > AppConstants.maxLogComponentChars) {
      return 'That part name is too long to record.'; // str(d.component, 80)
    }
    final km = log.mileageAtService;
    if (!(km >= 0 && km <= AppConstants.maxOdometerKm)) {
      return 'That odometer reading is out of range.'; // numIn(.., 0, 500000)
    }
    if (log.notes.length > AppConstants.maxLogNotesChars) {
      return 'That note is too long.'; // str(d.notes, 2000)
    }
    return null;
  }
}
