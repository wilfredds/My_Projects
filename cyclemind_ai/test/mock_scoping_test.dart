import 'dart:convert';
import 'dart:io';

import 'package:cyclemind_ai/core/providers/mock_store.dart';
import 'package:cyclemind_ai/features/auth/data/repositories/mock_auth_repository.dart';
import 'package:cyclemind_ai/features/bike_doctor/data/repositories/mock_reports_repository.dart';
import 'package:cyclemind_ai/features/bike_doctor/domain/entities/bike_health_report.dart';
import 'package:cyclemind_ai/core/constants/app_constants.dart';
import 'package:cyclemind_ai/features/bikes/data/repositories/mock_bikes_repository.dart';
import 'package:cyclemind_ai/features/bikes/domain/entities/bike.dart';
import 'package:cyclemind_ai/features/rides/data/repositories/mock_rides_repository.dart';
import 'package:flutter_test/flutter_test.dart';

/// Proves the cross-user leak is closed.
///
/// Every mock repository takes a `userId` and used to IGNORE it, returning the
/// whole process-wide store. Sign out, sign up as someone else, and the
/// previous user's garage was sitting there — in the DEFAULT build, which is
/// what the public demo runs.
///
/// Reads the real assets/data/mock_seed.json via dart:io, so a seed edit that
/// breaks the demo fails here.
Map<String, dynamic> _realSeed() =>
    jsonDecode(File('assets/data/mock_seed.json').readAsStringSync())
        as Map<String, dynamic>;

Bike _bikeFor(String userId, String id) => Bike(
      id: id, userId: userId, name: 'B', frame: 'f', groupset: 'g', tires: 't',
      totalMileageKm: 0,
    );

BikeHealthReport _reportFor(String userId, String id) => BikeHealthReport(
      id: id, userId: userId, healthScore: 80, riskLevel: RiskLevel.low,
      findings: const [], createdAt: DateTime(2026),
    );

void main() {
  // reset() re-reads mock_seed.json through rootBundle, which needs a binding.
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockStore store;

  setUp(() {
    store = MockStore.instance
      ..bikes.clear()
      ..rides.clear()
      ..logs.clear()
      ..reports.clear();
    store.applySeed(_realSeed());
  });

  group('seed integrity', () {
    test('every seeded row belongs to the seed user', () {
      final id = store.seedUser.id;
      expect(store.bikes, isNotEmpty);
      expect(store.rides, isNotEmpty);
      expect(store.bikes.every((b) => b.userId == id), isTrue);
      expect(store.rides.every((r) => r.userId == id), isTrue);
    });

    test('seeded rides carry a null odometer delta', () {
      // The seeded totalMileageKm is a lump figure that already includes these
      // rides. A non-null delta would make deleting one subtract twice.
      expect(store.rides.every((r) => r.odometerDeltaKm == null), isTrue);
    });

    test('rides are newest-first (defaultBikeId depends on it)', () {
      for (var i = 1; i < store.rides.length; i++) {
        expect(
          store.rides[i - 1].startedAt.isAfter(store.rides[i].startedAt) ||
              store.rides[i - 1].startedAt == store.rides[i].startedAt,
          isTrue,
        );
      }
    });
  });

  group('repositories honour userId', () {
    test('rides are scoped', () async {
      final repo = MockRidesRepository();
      final mine = await repo.getRides(store.seedUser.id);
      expect(mine.valueOrNull, isNotEmpty);

      final theirs = await repo.getRides('someone-else');
      expect(theirs.valueOrNull, isEmpty);
    });

    test('bikes are scoped', () async {
      final repo = MockBikesRepository();
      expect(await repo.watchBikes(store.seedUser.id).first, isNotEmpty);
      expect(await repo.watchBikes('someone-else').first, isEmpty);
    });

    test('reports are scoped', () async {
      final repo = MockReportsRepository();
      await repo.saveReport(_reportFor('alice', 'p1'));
      await repo.saveReport(_reportFor('bob', 'p2'));

      expect((await repo.watchReports('alice').first).single.id, 'p1');
      expect((await repo.watchReports('bob').first).single.id, 'p2');
    });

    test("one user's write never appears in another user's stream", () async {
      final repo = MockBikesRepository();
      await repo.addBike(_bikeFor('bob', 'bobs-bike'));

      final alices = await repo.watchBikes('alice').first;
      expect(alices.any((b) => b.id == 'bobs-bike'), isFalse);
    });
  });

  group('demo loop', _demoLoopTests);

  group('the reported leak, end to end', () {
    test('a new sign-up gets an empty garage, not the previous user\'s',
        () async {
      final auth = MockAuthRepository();
      final bikes = MockBikesRepository();
      final rides = MockRidesRepository();

      // Demo user signs in and sees the seeded garage.
      final demo = await auth.signInWithEmail(
          email: 'demo@example.com', password: 'x');
      final demoId = demo.valueOrNull!.id;
      expect(await bikes.watchBikes(demoId).first, isNotEmpty);

      await auth.signOut();

      final fresh = await auth.signUpWithEmail(
          email: 'bob@example.com', password: 'x', displayName: 'Bob');
      final bobId = fresh.valueOrNull!.id;

      expect(bobId, isNot(demoId));
      expect(await bikes.watchBikes(bobId).first, isEmpty);
      expect((await rides.getRides(bobId)).valueOrNull, isEmpty);
    });

    test('two sign-ups get distinct ids, neither the seed id', () async {
      final auth = MockAuthRepository();
      final a = await auth.signUpWithEmail(
          email: 'a@x.com', password: 'x', displayName: 'A');
      final b = await auth.signUpWithEmail(
          email: 'b@x.com', password: 'x', displayName: 'B');

      expect(a.valueOrNull!.id, isNot(b.valueOrNull!.id));
      expect(a.valueOrNull!.id, isNot(store.seedUser.id));
      expect(b.valueOrNull!.id, isNot(store.seedUser.id));
    });

    test('a signed-up user editing their profile cannot clobber the seed user',
        () async {
      final auth = MockAuthRepository();
      final before = store.seedUser;
      final fresh = await auth.signUpWithEmail(
          email: 'bob@x.com', password: 'x', displayName: 'Bob');

      await auth.updateProfile(fresh.valueOrNull!.copyWith(
          profile: fresh.valueOrNull!.profile.copyWith(displayName: 'Bobby')));

      expect(store.seedUser.id, before.id);
      expect(store.seedUser.profile.displayName, before.profile.displayName);
    });

    test('sign-out restores the seeded demo data', () async {
      final auth = MockAuthRepository();
      final bikes = MockBikesRepository();
      final seedCount = store.bikes.length;

      await bikes.addBike(_bikeFor(store.seedUser.id, 'extra'));
      expect(store.bikes.length, seedCount + 1);

      await auth.signOut();

      expect(store.bikes.any((b) => b.id == 'extra'), isFalse);
      expect(store.bikes.length, seedCount); // demo is intact for the next visitor
    });
  });
}

/// The demo must actually demonstrate the loop.
///
/// The seeded chain sits just under the 80% threshold, so the dashboard opens
/// on "All components healthy" — and a single seeded-size ride crosses it.
/// Without this the first reminder is ~4 long rides away and a reviewer never
/// sees the product's promise close.
void _demoLoopTests() {
  test('one seeded-size ride tips the chain into "due soon"', () {
    final store = MockStore.instance;
    final bike = store.bikes.firstWhere((b) => b.id == 'bike-1');
    final chain = bike.components.firstWhere((c) => c.id == 'c1');

    // Before: under the threshold, so the dashboard looks calm.
    expect(chain.wearFraction(bike.totalMileageKm), lessThan(0.8));

    // After one ride the size of the seeded Saturday endurance ride.
    final after = bike.copyWith(totalMileageKm: bike.totalMileageKm + 62.4);
    expect(chain.wearFraction(after.totalMileageKm), greaterThan(0.8));
  });
}
