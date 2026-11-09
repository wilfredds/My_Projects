import 'package:cyclemind_ai/core/error/failures.dart';
import 'package:cyclemind_ai/core/utils/result.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/rides/domain/entities/ride.dart';
import 'package:cyclemind_ai/features/rides/domain/repositories/rides_repository.dart';
import 'package:cyclemind_ai/features/rides/domain/usecases/log_ride.dart';
import 'package:flutter_test/flutter_test.dart';

/// Fake repository that applies the odometer the way the real ones do, and
/// reproduces the denials the Firestore rules enforce.
class _FakeRides implements RidesRepository {
  _FakeRides({this.bikes = const [], this.failWith});

  List<Bike> bikes;
  final AppFailure? failWith;
  final List<Ride> saved = [];

  @override
  Future<Result<Ride>> addRide(Ride ride) async {
    if (failWith != null) return Failure(failWith!);
    if (saved.any((r) => r.id == ride.id)) {
      return Failure(const ValidationFailure('duplicate'));
    }
    saved.add(ride);
    final d = ride.odometerDeltaKm;
    if (ride.bikeId != null && d != null) {
      bikes = [
        for (final b in bikes)
          b.id == ride.bikeId
              ? b.copyWith(totalMileageKm: b.totalMileageKm + d)
              : b
      ];
    }
    return Success(ride);
  }

  @override
  Future<Result<void>> deleteRide(Ride ride) async {
    saved.removeWhere((r) => r.id == ride.id);
    final d = ride.odometerDeltaKm;
    if (ride.bikeId != null && d != null) {
      bikes = [
        for (final b in bikes)
          b.id == ride.bikeId
              ? b.copyWith(
                  totalMileageKm:
                      (b.totalMileageKm - d).clamp(0, double.infinity))
              : b
      ];
    }
    return const Success(null);
  }

  @override
  Stream<List<Ride>> watchRides(String userId) => Stream.value(saved);
  @override
  Future<Result<List<Ride>>> getRides(String userId) async => Success(saved);
}

Bike _bike({
  String id = 'b1',
  double km = 1000,
  List<BikeComponent> components = const [],
}) =>
    Bike(
      id: id,
      userId: 'u1',
      name: 'Roadie',
      frame: 'f',
      groupset: 'g',
      tires: 't',
      totalMileageKm: km,
      components: components,
    );

BikeComponent _chain({double installedAt = 0, double lifespan = 1000}) =>
    BikeComponent(
      id: 'c1',
      type: 'Chain',
      brand: 'Shimano',
      installedAtKm: installedAt,
      lifespanKm: lifespan,
    );

void main() {
  group('LogRide odometer', () {
    test('a ride against a bike increments exactly its distance', () async {
      final repo = _FakeRides(bikes: [_bike(km: 1000), _bike(id: 'b2', km: 50)]);
      final r = await LogRide(repo).call(
        rideId: 'r1', userId: 'u1', title: 'Ride',
        distanceKm: 42, elevationM: 100, durationSec: 3600,
        bike: repo.bikes.first,
      );

      expect(r.isSuccess, isTrue);
      expect(repo.bikes.firstWhere((b) => b.id == 'b1').totalMileageKm, 1042);
      // Every other bike untouched.
      expect(repo.bikes.firstWhere((b) => b.id == 'b2').totalMileageKm, 50);
      expect(r.valueOrNull!.odometerMoved, isTrue);
      expect(r.valueOrNull!.odometerAfterKm, 1042);
    });

    test('no bike selected: ride saved, nothing incremented, delta null',
        () async {
      final repo = _FakeRides(bikes: [_bike(km: 1000)]);
      final r = await LogRide(repo).call(
        rideId: 'r1', userId: 'u1', title: 'Ride',
        distanceKm: 42, elevationM: 0, durationSec: 3600,
      );

      expect(r.isSuccess, isTrue);
      expect(r.valueOrNull!.odometerMoved, isFalse);
      expect(repo.saved.single.odometerDeltaKm, isNull);
      expect(repo.bikes.single.totalMileageKm, 1000);
    });

    test('delta is non-null iff bikeId is non-null', () async {
      final repo = _FakeRides(bikes: [_bike()]);
      await LogRide(repo).call(
        rideId: 'with', userId: 'u1', title: 'x',
        distanceKm: 10, elevationM: 0, durationSec: 3600, bike: repo.bikes.first,
      );
      await LogRide(repo).call(
        rideId: 'without', userId: 'u1', title: 'x',
        distanceKm: 10, elevationM: 0, durationSec: 3600,
      );

      final a = repo.saved.firstWhere((r) => r.id == 'with');
      final b = repo.saved.firstWhere((r) => r.id == 'without');
      expect(a.bikeId != null, a.odometerDeltaKm != null);
      expect(b.bikeId != null, b.odometerDeltaKm != null);
    });

    test('a failed save leaves the odometer untouched', () async {
      final repo =
          _FakeRides(bikes: [_bike(km: 1000)], failWith: const ServerFailure());
      final r = await LogRide(repo).call(
        rideId: 'r1', userId: 'u1', title: 'x',
        distanceKm: 42, elevationM: 0, durationSec: 3600, bike: _bike(km: 1000),
      );

      expect(r.isSuccess, isFalse);
      expect(repo.saved, isEmpty);
      expect(repo.bikes.single.totalMileageKm, 1000);
    });

    test('the same rideId twice counts once', () async {
      final repo = _FakeRides(bikes: [_bike(km: 1000)]);
      final use = LogRide(repo);
      Future<void> attempt() => use.call(
            rideId: 'same', userId: 'u1', title: 'x',
            distanceKm: 42, elevationM: 0, durationSec: 3600,
            bike: repo.bikes.first,
          );

      await attempt();
      final second = await use.call(
        rideId: 'same', userId: 'u1', title: 'x',
        distanceKm: 42, elevationM: 0, durationSec: 3600, bike: repo.bikes.first,
      );

      expect(second.isSuccess, isFalse);
      expect(repo.saved.length, 1);
      expect(repo.bikes.single.totalMileageKm, 1042); // not 1084
    });
  });

  group('LogRide reminders', () {
    test('reports a component that newly crosses into due', () async {
      // 790/1000 = 79% -> OK. +20 km -> 81% -> dueSoon.
      final bike = _bike(km: 790, components: [_chain()]);
      final repo = _FakeRides(bikes: [bike]);
      final r = await LogRide(repo).call(
        rideId: 'r1', userId: 'u1', title: 'x',
        distanceKm: 20, elevationM: 0, durationSec: 3600, bike: bike,
      );

      expect(r.valueOrNull!.newlyDue.single.component.id, 'c1');
    });

    test('reports nothing when it was already due', () async {
      final bike = _bike(km: 900, components: [_chain()]); // already 90%
      final repo = _FakeRides(bikes: [bike]);
      final r = await LogRide(repo).call(
        rideId: 'r1', userId: 'u1', title: 'x',
        distanceKm: 20, elevationM: 0, durationSec: 3600, bike: bike,
      );

      expect(r.valueOrNull!.newlyDue, isEmpty);
    });
  });

  group('LogRide validation', () {
    final repo = _FakeRides(bikes: [_bike()]);
    Future<Result<RideLogged>> run({
      double distance = 10,
      int duration = 3600,
      double elevation = 0,
    }) =>
        LogRide(repo).call(
          rideId: 'v', userId: 'u1', title: 'x',
          distanceKm: distance, elevationM: elevation, durationSec: duration,
        );

    test('rejects zero/negative distance', () async {
      expect((await run(distance: 0)).isSuccess, isFalse);
      expect((await run(distance: -5)).isSuccess, isFalse);
    });

    test('rejects zero duration', () async {
      expect((await run(duration: 0)).isSuccess, isFalse);
    });

    test('rejects an absurd derived speed (50 km in 1 min = 3000 km/h)',
        () async {
      expect((await run(distance: 50, duration: 60)).isSuccess, isFalse);
    });

    test('rejects a distance beyond the rules ceiling', () async {
      expect((await run(distance: 2001, duration: 360000)).isSuccess, isFalse);
    });
  });

  group('DeleteRide', () {
    test('credits back exactly what the ride added', () async {
      final repo = _FakeRides(bikes: [_bike(km: 1000)]);
      await LogRide(repo).call(
        rideId: 'r1', userId: 'u1', title: 'x',
        distanceKm: 42, elevationM: 0, durationSec: 3600, bike: repo.bikes.first,
      );
      expect(repo.bikes.single.totalMileageKm, 1042);

      await DeleteRide(repo).call(repo.saved.single);
      expect(repo.bikes.single.totalMileageKm, 1000);
    });

    test('a legacy ride (null delta) deletes without touching the odometer',
        () async {
      // Exactly the seeded-demo case: a lump odometer that already includes
      // this ride. Subtracting would corrupt it.
      final repo = _FakeRides(bikes: [_bike(km: 4200)]);
      final legacy = Ride(
        id: 'seed', userId: 'u1', bikeId: 'b1',
        startedAt: DateTime(2026), distanceKm: 62.4, elevationM: 540,
        avgSpeedKmh: 27.8, durationSec: 8080, calories: 1480,
      );
      await DeleteRide(repo).call(legacy);
      expect(repo.bikes.single.totalMileageKm, 4200);
    });

    test('clamps at zero rather than going negative', () async {
      final repo = _FakeRides(bikes: [_bike(km: 10)]);
      final ride = Ride(
        id: 'r', userId: 'u1', bikeId: 'b1', startedAt: DateTime(2026),
        distanceKm: 50, elevationM: 0, avgSpeedKmh: 25, durationSec: 7200,
        calories: 100, odometerDeltaKm: 50,
      );
      await DeleteRide(repo).call(ride);
      // Negative would be denied outright by firestore.rules.
      expect(repo.bikes.single.totalMileageKm, 0);
    });
  });

  group('defaultBikeId', () {
    final b1 = _bike(id: 'b1');
    final b2 = _bike(id: 'b2');
    Ride rideOn(String? bikeId, {String id = 'r'}) => Ride(
          id: id, userId: 'u1', bikeId: bikeId, startedAt: DateTime(2026),
          distanceKm: 10, elevationM: 0, avgSpeedKmh: 20, durationSec: 1800,
          calories: 100,
        );

    test('prefers the last-used bike', () {
      expect(defaultBikeId([b1, b2], [rideOn('b2'), rideOn('b1', id: 'old')]),
          'b2');
    });

    test('falls back to the only bike', () {
      expect(defaultBikeId([b1], const []), 'b1');
    });

    test('returns null with several bikes and no history', () {
      expect(defaultBikeId([b1, b2], const []), isNull);
    });

    test('ignores a bikeId that no longer resolves', () {
      expect(defaultBikeId([b1, b2], [rideOn('deleted')]), isNull);
    });

    test('returns null with no bikes', () {
      expect(defaultBikeId(const [], const []), isNull);
    });
  });
}
