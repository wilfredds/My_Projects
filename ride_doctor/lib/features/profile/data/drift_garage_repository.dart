import 'package:drift/drift.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/core/database/enum_text.dart';
import 'package:ride_doctor/features/profile/domain/bike.dart';
import 'package:ride_doctor/features/profile/domain/garage_repository.dart';

final class DriftGarageRepository implements GarageRepository {
  const new(this._db, {required this.clock, required this.newId});

  final AppDatabase _db;
  final DateTime Function() clock;
  final String Function() newId;

  @override
  Stream<Bike?> watchBike() {
    final query =
        _db.select(_db.bikes).join([
            leftOuterJoin(
              _db.drivetrains,
              _db.drivetrains.bikeId.equalsExp(_db.bikes.id),
            ),
          ])
          ..orderBy([OrderingTerm.asc(_db.bikes.createdAt)])
          ..limit(1);
    return query.watchSingleOrNull().map((row) {
      if (row == null) return null;
      return _toDomain(
        row.readTable(_db.bikes),
        row.readTableOrNull(_db.drivetrains),
      );
    });
  }

  @override
  Future<void> saveBike(Bike bike) async {
    final now = clock();
    await _db.transaction(() async {
      final values = BikesCompanion(
        bikeType: Value(bike.type.name),
        beadSeatDiameterMm: Value(bike.beadSeatDiameterMm),
        tyreWidthMm: Value(bike.tyreWidthMm),
        rollOutMm: Value(bike.rollOutMm),
        crankLengthMm: Value(bike.crankLengthMm),
        pedals: Value(bike.pedals?.name),
        saddleHeightMm: Value(bike.saddleHeightMm),
        tyrePressureKpa: Value(bike.tyrePressureKpa),
        updatedAt: Value(now),
      );
      final updated = await (_db.update(
        _db.bikes,
      )..where((row) => row.id.equals(bike.id))).write(values);
      if (updated == 0) {
        await _db
            .into(_db.bikes)
            .insert(values.copyWith(id: Value(bike.id), createdAt: Value(now)));
      }

      // The drivetrain is replaced wholesale: it is small, and that keeps
      // "removed the drivetrain" and "changed it" on one code path.
      await (_db.delete(
        _db.drivetrains,
      )..where((row) => row.bikeId.equals(bike.id))).go();
      final drivetrain = bike.drivetrain;
      if (drivetrain != null) {
        await _db
            .into(_db.drivetrains)
            .insert(
              DrivetrainsCompanion.insert(
                id: newId(),
                createdAt: now,
                updatedAt: now,
                bikeId: bike.id,
                chainrings: teethToText(drivetrain.chainrings),
                cogs: teethToText(drivetrain.cogs),
                cogsConfirmed: drivetrain.cogsConfirmed,
              ),
            );
      }
    });
  }

  @override
  Stream<Set<SensorKind>> watchSensors() => _db
      .select(_db.sensors)
      .watch()
      .map(
        (rows) => {
          for (final row in rows) ?enumFromName(SensorKind.values, row.kind),
        },
      );

  @override
  Future<void> setSensors(Set<SensorKind> kinds) async {
    final now = clock();
    final names = kinds.map((kind) => kind.name).toList();
    await _db.transaction(() async {
      await (_db.delete(
        _db.sensors,
      )..where((row) => row.kind.isNotIn(names))).go();
      final existing = await _db.select(_db.sensors).get();
      final have = existing.map((row) => row.kind).toSet();
      for (final name in names.where((name) => !have.contains(name))) {
        await _db
            .into(_db.sensors)
            .insert(
              SensorsCompanion.insert(
                id: newId(),
                createdAt: now,
                updatedAt: now,
                kind: name,
              ),
            );
      }
    });
  }

  Bike _toDomain(BikeRow bike, DrivetrainRow? drivetrain) => Bike(
    id: bike.id,
    type: enumFromName(BikeType.values, bike.bikeType) ?? BikeType.road,
    beadSeatDiameterMm: bike.beadSeatDiameterMm,
    tyreWidthMm: bike.tyreWidthMm,
    rollOutMm: bike.rollOutMm,
    crankLengthMm: bike.crankLengthMm,
    pedals: enumFromName(PedalType.values, bike.pedals),
    saddleHeightMm: bike.saddleHeightMm,
    tyrePressureKpa: bike.tyrePressureKpa,
    drivetrain: drivetrain == null
        ? null
        : Drivetrain(
            chainrings: teethFromText(drivetrain.chainrings),
            cogs: teethFromText(drivetrain.cogs),
            cogsConfirmed: drivetrain.cogsConfirmed,
          ),
  );
}
