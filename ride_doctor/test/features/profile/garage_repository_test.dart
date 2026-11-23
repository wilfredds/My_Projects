import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/features/profile/data/drift_garage_repository.dart';
import 'package:ride_doctor/features/profile/domain/bike.dart';

import '../../helpers/test_database.dart';

const roadBike = Bike(
  id: 'bike-1',
  type: BikeType.road,
  beadSeatDiameterMm: 622,
  tyreWidthMm: 25,
  crankLengthMm: 160,
  pedals: PedalType.flat,
  saddleHeightMm: 762,
  drivetrain: Drivetrain(
    chainrings: [34, 50],
    cogs: [11, 13, 15, 17, 19, 21, 24, 27, 30, 34],
    cogsConfirmed: false,
  ),
);

void main() {
  late AppDatabase database;
  late FakeClock clock;
  late DriftGarageRepository repository;

  setUp(() {
    database = newTestDatabase();
    clock = FakeClock();
    repository = DriftGarageRepository(
      database,
      clock: clock.call,
      newId: sequentialIds(),
    );
  });

  tearDown(() => database.close());

  group('bike', () {
    test('there is no bike at first', () async {
      expect(await repository.watchBike().first, isNull);
    });

    test('a bike with its drivetrain round-trips', () async {
      await repository.saveBike(roadBike);

      expect(await repository.watchBike().first, roadBike);
    });

    test('a bike without a drivetrain round-trips', () async {
      const bare = Bike(id: 'bike-1', type: BikeType.gravel);
      await repository.saveBike(bare);

      expect(await repository.watchBike().first, bare);
    });

    test('saving the same id updates in place', () async {
      await repository.saveBike(roadBike);
      clock.advance(const Duration(hours: 1));
      await repository.saveBike(
        roadBike.copyWith(
          tyreWidthMm: 28,
          drivetrain: roadBike.drivetrain!.copyWith(cogsConfirmed: true),
        ),
      );

      final bike = await repository.watchBike().first;
      expect(bike!.tyreWidthMm, 28);
      expect(bike.drivetrain!.cogsConfirmed, isTrue);
      expect(await database.select(database.bikes).get(), hasLength(1));
      expect(await database.select(database.drivetrains).get(), hasLength(1));
    });

    test('removing the drivetrain deletes it', () async {
      await repository.saveBike(roadBike);
      await repository.saveBike(roadBike.copyWith(drivetrain: null));

      expect((await repository.watchBike().first)!.drivetrain, isNull);
      expect(await database.select(database.drivetrains).get(), isEmpty);
    });

    test('the first bike added is the one returned', () async {
      await repository.saveBike(roadBike);
      clock.advance(const Duration(days: 1));
      await repository.saveBike(const Bike(id: 'bike-2', type: BikeType.mtb));

      expect((await repository.watchBike().first)!.id, 'bike-1');
    });

    test(
      'an unknown bike type from a newer version falls back to road',
      () async {
        await repository.saveBike(roadBike);
        await database.customStatement(
          "UPDATE bikes SET bike_type = 'recumbent'",
        );

        expect((await repository.watchBike().first)!.type, BikeType.road);
      },
    );
  });

  group('sensors', () {
    test('none at first', () async {
      expect(await repository.watchSensors().first, isEmpty);
    });

    test('setSensors makes the stored set exactly what was given', () async {
      await repository.setSensors({SensorKind.hrStrap, SensorKind.cadence});
      expect(await repository.watchSensors().first, {
        SensorKind.hrStrap,
        SensorKind.cadence,
      });

      await repository.setSensors({SensorKind.hrStrap, SensorKind.powerMeter});
      expect(await repository.watchSensors().first, {
        SensorKind.hrStrap,
        SensorKind.powerMeter,
      });

      await repository.setSensors({});
      expect(await repository.watchSensors().first, isEmpty);
    });

    test('a sensor that stays keeps its original row', () async {
      await repository.setSensors({SensorKind.hrStrap});
      final before = await database.select(database.sensors).getSingle();
      clock.advance(const Duration(days: 1));
      await repository.setSensors({SensorKind.hrStrap, SensorKind.speed});

      final rows = await database.select(database.sensors).get();
      expect(rows.firstWhere((row) => row.kind == 'hrStrap').id, before.id);
      expect(rows, hasLength(2));
    });
  });
}
