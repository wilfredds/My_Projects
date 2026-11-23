import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/features/profile/data/drift_rider_repository.dart';
import 'package:ride_doctor/features/profile/domain/rider_profile.dart';

import '../../helpers/test_database.dart';

const essentials = RiderProfile(
  displayName: 'France',
  birthYear: 2004,
  heightCm: 165,
  weightKg: 58.5,
  yearsRiding: 1.5,
  ridesPerWeek: 4,
  typicalRideMinutes: 90,
  hoursPerWeek: 8,
  goal: RidingGoal.raceFaster,
);

void main() {
  late AppDatabase database;
  late FakeClock clock;
  late DriftRiderRepository repository;

  setUp(() {
    database = newTestDatabase();
    clock = FakeClock();
    repository = DriftRiderRepository(
      database,
      clock: clock.call,
      newId: sequentialIds(),
    );
  });

  tearDown(() => database.close());

  test('there is no profile before onboarding', () async {
    expect(await repository.watchProfile().first, isNull);
  });

  test('a saved profile reads back identical, optional fields empty', () async {
    await repository.saveProfile(essentials);

    final stored = await repository.watchProfile().first;
    expect(stored, essentials);
    expect(stored!.inseamMm, isNull);
    expect(stored.sex, isNull);
  });

  test('every optional field round-trips', () async {
    final full = essentials.copyWith(
      sex: Sex.preferNotToSay,
      inseamMm: 760,
      restingHrBpm: 52,
      maxHrBpm: 198,
      ftpWatts: 188,
      lthrBpm: 171,
    );
    await repository.saveProfile(full);

    expect(await repository.watchProfile().first, full);
  });

  test(
    'saving again updates the one row and keeps its id and creation time',
    () async {
      await repository.saveProfile(essentials);
      clock.advance(const Duration(days: 3));
      await repository.saveProfile(essentials.copyWith(weightKg: 60));

      final rows = await database.select(database.riderProfiles).get();
      expect(rows, hasLength(1));
      expect(rows.single.id, 'id-1');
      expect(rows.single.weightKg, 60);
      expect(rows.single.createdAt, DateTime.utc(2026, 11, 23, 8));
      expect(rows.single.updatedAt, DateTime.utc(2026, 11, 26, 8));
    },
  );

  test('clearing an optional field stores null, not the old value', () async {
    await repository.saveProfile(essentials.copyWith(ftpWatts: 200));
    await repository.saveProfile(essentials);

    expect((await repository.watchProfile().first)!.ftpWatts, isNull);
  });

  test('the stream emits each change', () async {
    final seen = <double?>[];
    final subscription = repository.watchProfile().listen(
      (profile) => seen.add(profile?.weightKg),
    );
    addTearDown(subscription.cancel);
    await pumpEventQueue();

    await repository.saveProfile(essentials);
    await pumpEventQueue();
    await repository.saveProfile(essentials.copyWith(weightKg: 61));
    await pumpEventQueue();

    expect(seen, [null, 58.5, 61]);
  });

  test(
    'a goal written by a newer app version falls back, not crashes',
    () async {
      await repository.saveProfile(essentials);
      await database.customStatement(
        "UPDATE rider_profiles SET goal = 'winTheTour', sex = 'unknownValue'",
      );

      final stored = await repository.watchProfile().first;
      expect(stored!.goal, RidingGoal.generalFitness);
      expect(stored.sex, isNull);
    },
  );
}
