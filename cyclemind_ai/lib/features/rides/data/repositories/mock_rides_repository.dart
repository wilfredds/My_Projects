import 'dart:async';

import 'package:cyclemind_ai/core/providers/mock_store.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/features/rides/domain/entities/ride.dart';
import 'package:cyclemind_ai/features/rides/domain/repositories/rides_repository.dart';

/// In-memory [RidesRepository] over the shared [MockStore].
class MockRidesRepository implements RidesRepository {
  final _controller = StreamController<List<Ride>>.broadcast();

  void _emit() {
    final list = [...MockStore.instance.rides]
      ..sort((a, b) => b.startedAt.compareTo(a.startedAt));
    _controller.add(list);
  }

  @override
  Stream<List<Ride>> watchRides(String userId) async* {
    await MockStore.instance.ensureLoaded();
    yield [...MockStore.instance.rides]
      ..sort((a, b) => b.startedAt.compareTo(a.startedAt));
    yield* _controller.stream;
  }

  @override
  Future<Result<List<Ride>>> getRides(String userId) async {
    await MockStore.instance.ensureLoaded();
    return Success([...MockStore.instance.rides]
      ..sort((a, b) => b.startedAt.compareTo(a.startedAt)));
  }

  @override
  Future<Result<Ride>> addRide(Ride ride) async {
    MockStore.instance.rides.add(ride);
    _emit();
    return Success(ride);
  }

  @override
  Future<Result<void>> deleteRide(String rideId) async {
    MockStore.instance.rides.removeWhere((r) => r.id == rideId);
    _emit();
    return const Success(null);
  }
}
