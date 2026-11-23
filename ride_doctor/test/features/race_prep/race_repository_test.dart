import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/features/race_prep/data/drift_race_repository.dart';
import 'package:ride_doctor/features/race_prep/domain/race_checklist.dart';
import 'package:ride_doctor/features/race_prep/domain/race_debrief.dart';
import 'package:ride_doctor/features/race_prep/domain/race_event.dart';

import '../../helpers/test_database.dart';

final crit = RaceEvent(
  id: 'race-1',
  name: 'Cavite Crit',
  type: RaceType.criterium,
  startsAt: DateTime(2027, 3, 14, 6, 30),
  location: 'Dasmariñas',
  durationMinutes: 40,
  laps: 20,
  lapLengthKm: 1.2,
  cornerCount: 4,
  category: 'Beginner',
  rulesNotes: 'Lapped riders are pulled',
  travelMinutes: 45,
  reconAllowed: false,
);

void main() {
  late AppDatabase database;
  late FakeClock clock;
  late DriftRaceRepository repository;

  setUp(() {
    database = newTestDatabase();
    clock = FakeClock();
    repository = DriftRaceRepository(
      database,
      clock: clock.call,
      newId: sequentialIds(),
    );
  });

  tearDown(() => database.close());

  group('races', () {
    test('none at first', () async {
      expect(await repository.watchRaces().first, isEmpty);
      expect(await repository.watchRace('race-1').first, isNull);
    });

    test('a race round-trips with every field', () async {
      await repository.saveRace(crit);

      expect(await repository.watchRace('race-1').first, crit);
    });

    test('the start is stored as wall-clock time with no zone', () async {
      await repository.saveRace(crit);

      final row = await database.select(database.raceEvents).getSingle();
      expect(row.startsAtLocal, '2027-03-14T06:30:00.000');
    });

    test('a race with only the essentials round-trips', () async {
      final bare = RaceEvent(
        id: 'race-2',
        name: 'Sunday TT',
        type: RaceType.timeTrial,
        startsAt: DateTime(2027, 5, 2, 7),
      );
      await repository.saveRace(bare);

      final stored = await repository.watchRace('race-2').first;
      expect(stored, bare);
      expect(stored!.travelMinutes, 30);
      expect(stored.reconAllowed, isTrue);
    });

    test('saving the same id updates in place', () async {
      await repository.saveRace(crit);
      await repository.saveRace(crit.copyWith(name: 'Cavite Crit 2', laps: 25));

      final races = await repository.watchRaces().first;
      expect(races, hasLength(1));
      expect(races.single.name, 'Cavite Crit 2');
      expect(races.single.laps, 25);
    });

    test(
      'races come back earliest first, whatever order they were added',
      () async {
        await repository.saveRace(crit);
        await repository.saveRace(
          crit.copyWith(id: 'early', startsAt: DateTime(2026, 12, 5, 8)),
        );
        await repository.saveRace(
          crit.copyWith(id: 'late', startsAt: DateTime(2027, 8, 1, 6)),
        );

        final ids = (await repository.watchRaces().first).map(
          (race) => race.id,
        );
        expect(ids, ['early', 'race-1', 'late']);
      },
    );

    test('an unknown race type from a newer version falls back', () async {
      await repository.saveRace(crit);
      await database.customStatement(
        "UPDATE race_events SET race_type = 'cyclocross'",
      );

      expect(
        (await repository.watchRace('race-1').first)!.type,
        RaceType.roadRace,
      );
    });
  });

  group('checklist', () {
    setUp(() => repository.saveRace(crit));

    test('nothing is ticked at first', () async {
      expect(await repository.watchChecked('race-1').first, isEmpty);
    });

    test('ticking and unticking', () async {
      await repository.setChecked(
        'race-1',
        ChecklistItem.helmet,
        checked: true,
      );
      await repository.setChecked(
        'race-1',
        ChecklistItem.tyrePressure,
        checked: true,
      );
      expect(await repository.watchChecked('race-1').first, {
        ChecklistItem.helmet,
        ChecklistItem.tyrePressure,
      });

      await repository.setChecked(
        'race-1',
        ChecklistItem.helmet,
        checked: false,
      );
      expect(await repository.watchChecked('race-1').first, {
        ChecklistItem.tyrePressure,
      });
    });

    test('ticking twice keeps one row per item', () async {
      for (var i = 0; i < 3; i++) {
        await repository.setChecked(
          'race-1',
          ChecklistItem.helmet,
          checked: true,
        );
      }
      expect(
        await database.select(database.raceChecklistItems).get(),
        hasLength(1),
      );
    });

    test('each race has its own ticks', () async {
      await repository.saveRace(crit.copyWith(id: 'race-2'));
      await repository.setChecked(
        'race-1',
        ChecklistItem.helmet,
        checked: true,
      );

      expect(await repository.watchChecked('race-2').first, isEmpty);
    });

    test('reset unticks everything, ready to reuse', () async {
      await repository.setChecked(
        'race-1',
        ChecklistItem.helmet,
        checked: true,
      );
      await repository.resetChecklist('race-1');

      expect(await repository.watchChecked('race-1').first, isEmpty);
    });
  });

  group('debrief', () {
    setUp(() => repository.saveRace(crit));

    final debrief = RaceDebrief(
      raceId: 'race-1',
      finished: true,
      placing: 10,
      fieldSize: 10,
      droppedWhen: DroppedWhen.midRace,
      struggles: const {StruggleArea.climbs, StruggleArea.accelerations},
      symptoms: const {RaceSymptom.cramps},
      wouldChange: 'Easier gears; start nearer the front',
      recordedAt: DateTime.utc(2026, 11, 23, 8),
    );

    test('none at first', () async {
      expect(await repository.watchDebriefs().first, isEmpty);
    });

    test('a debrief round-trips, keyed by its race', () async {
      await repository.saveDebrief(debrief);

      expect(await repository.watchDebriefs().first, {'race-1': debrief});
    });

    test('an empty debrief round-trips', () async {
      final empty = RaceDebrief(
        raceId: 'race-1',
        finished: false,
        droppedWhen: DroppedWhen.notDropped,
        recordedAt: DateTime.utc(2026, 11, 23, 8),
      );
      await repository.saveDebrief(empty);

      expect((await repository.watchDebriefs().first)['race-1'], empty);
    });

    test('saving again replaces it: one debrief per race', () async {
      await repository.saveDebrief(debrief);
      await repository.saveDebrief(debrief.copyWith(placing: 8));

      final stored = await repository.watchDebriefs().first;
      expect(stored, hasLength(1));
      expect(stored['race-1']!.placing, 8);
      expect(await database.select(database.raceDebriefs).get(), hasLength(1));
    });
  });

  test('deleting a race removes its checklist and debrief too', () async {
    await repository.saveRace(crit);
    await repository.setChecked('race-1', ChecklistItem.helmet, checked: true);
    await repository.saveDebrief(
      RaceDebrief(
        raceId: 'race-1',
        finished: true,
        droppedWhen: DroppedWhen.notDropped,
        recordedAt: DateTime.utc(2026, 11, 23),
      ),
    );

    await repository.deleteRace('race-1');

    expect(await repository.watchRaces().first, isEmpty);
    expect(await database.select(database.raceChecklistItems).get(), isEmpty);
    expect(await database.select(database.raceDebriefs).get(), isEmpty);
  });
}
