import 'dart:async';

import 'package:cyclemind_ai/core/providers/mock_store.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/maintenance_log.dart';
import 'package:cyclemind_ai/features/bikes/domain/repositories/bikes_repository.dart';

/// In-memory [BikesRepository] over the shared [MockStore].
class MockBikesRepository implements BikesRepository {
  final _bikesController = StreamController<List<Bike>>.broadcast();
  final _logsController = StreamController<List<MaintenanceLog>>.broadcast();

  void _emitBikes() =>
      _bikesController.add([...MockStore.instance.bikes]);

  void _emitLogs(String bikeId) => _logsController.add(
      MockStore.instance.logs.where((l) => l.bikeId == bikeId).toList());

  @override
  Stream<List<Bike>> watchBikes(String userId) async* {
    await MockStore.instance.ensureLoaded();
    yield [...MockStore.instance.bikes];
    yield* _bikesController.stream;
  }

  @override
  Future<Result<Bike>> addBike(Bike bike) async {
    MockStore.instance.bikes.add(bike);
    _emitBikes();
    return Success(bike);
  }

  @override
  Future<Result<Bike>> updateBike(Bike bike) async {
    final i = MockStore.instance.bikes.indexWhere((b) => b.id == bike.id);
    if (i >= 0) MockStore.instance.bikes[i] = bike;
    _emitBikes();
    return Success(bike);
  }

  @override
  Future<Result<void>> deleteBike(String bikeId) async {
    MockStore.instance.bikes.removeWhere((b) => b.id == bikeId);
    _emitBikes();
    return const Success(null);
  }

  @override
  Stream<List<MaintenanceLog>> watchLogs(String userId, String bikeId) async* {
    bool mine(MaintenanceLog l) => l.userId == userId && l.bikeId == bikeId;
    yield MockStore.instance.logs.where(mine).toList();
    yield* _logsController.stream.map((all) => all.where(mine).toList());
  }

  @override
  Future<Result<MaintenanceLog>> addLog(MaintenanceLog log) async {
    MockStore.instance.logs.add(log);
    _emitLogs(log.bikeId);
    return Success(log);
  }
}
