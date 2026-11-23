import 'package:drift/drift.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/core/database/enum_text.dart';
import 'package:ride_doctor/features/profile/domain/rider_profile.dart';
import 'package:ride_doctor/features/profile/domain/rider_repository.dart';

final class DriftRiderRepository implements RiderRepository {
  const new(this._db, {required this.clock, required this.newId});

  final AppDatabase _db;
  final DateTime Function() clock;
  final String Function() newId;

  @override
  Stream<RiderProfile?> watchProfile() => _db
      .select(_db.riderProfiles)
      .watchSingleOrNull()
      .map((row) => row == null ? null : _toDomain(row));

  @override
  Future<void> saveProfile(RiderProfile profile) async {
    final now = clock();
    final values = RiderProfilesCompanion(
      displayName: Value(profile.displayName),
      birthYear: Value(profile.birthYear),
      sex: Value(profile.sex?.name),
      heightCm: Value(profile.heightCm),
      weightKg: Value(profile.weightKg),
      inseamMm: Value(profile.inseamMm),
      restingHrBpm: Value(profile.restingHrBpm),
      maxHrBpm: Value(profile.maxHrBpm),
      ftpWatts: Value(profile.ftpWatts),
      lthrBpm: Value(profile.lthrBpm),
      yearsRiding: Value(profile.yearsRiding),
      ridesPerWeek: Value(profile.ridesPerWeek),
      typicalRideMinutes: Value(profile.typicalRideMinutes),
      hoursPerWeek: Value(profile.hoursPerWeek),
      goal: Value(profile.goal.name),
      updatedAt: Value(now),
    );
    // Read-then-write must be one transaction, or two saves racing each other
    // could both see "no row" and insert two profiles.
    await _db.transaction(() async {
      final existing = await _db.select(_db.riderProfiles).getSingleOrNull();
      if (existing == null) {
        await _db
            .into(_db.riderProfiles)
            .insert(values.copyWith(id: Value(newId()), createdAt: Value(now)));
      } else {
        await (_db.update(
          _db.riderProfiles,
        )..where((row) => row.id.equals(existing.id))).write(values);
      }
    });
  }

  RiderProfile _toDomain(RiderProfileRow row) => RiderProfile(
    displayName: row.displayName,
    birthYear: row.birthYear,
    sex: enumFromName(Sex.values, row.sex),
    heightCm: row.heightCm,
    weightKg: row.weightKg,
    inseamMm: row.inseamMm,
    restingHrBpm: row.restingHrBpm,
    maxHrBpm: row.maxHrBpm,
    ftpWatts: row.ftpWatts,
    lthrBpm: row.lthrBpm,
    yearsRiding: row.yearsRiding,
    ridesPerWeek: row.ridesPerWeek,
    typicalRideMinutes: row.typicalRideMinutes,
    hoursPerWeek: row.hoursPerWeek,
    goal:
        enumFromName(RidingGoal.values, row.goal) ?? RidingGoal.generalFitness,
  );
}
