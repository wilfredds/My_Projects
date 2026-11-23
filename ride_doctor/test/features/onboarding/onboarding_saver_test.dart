import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/features/onboarding/data/drift_onboarding_repositories.dart';
import 'package:ride_doctor/features/onboarding/data/onboarding_saver.dart';
import 'package:ride_doctor/features/onboarding/domain/consent.dart';
import 'package:ride_doctor/features/onboarding/domain/readiness.dart';
import 'package:ride_doctor/features/profile/data/drift_garage_repository.dart';
import 'package:ride_doctor/features/profile/data/drift_rider_repository.dart';
import 'package:ride_doctor/features/profile/domain/bike.dart';
import 'package:ride_doctor/features/profile/domain/garage_repository.dart';

import '../../helpers/pump_app.dart' show testNow, testRider;
import '../../helpers/test_database.dart';

/// A garage that fails on save, to prove the transaction rolls back.
final class _BrokenGarage implements GarageRepository {
  @override
  Future<void> saveBike(Bike bike) async => throw StateError('disk full');

  @override
  Future<void> setSensors(Set<SensorKind> kinds) async {}

  @override
  Stream<Bike?> watchBike() => const Stream.empty();

  @override
  Stream<Set<SensorKind>> watchSensors() => const Stream.empty();
}

void main() {
  late AppDatabase database;

  setUp(() => database = newTestDatabase());
  tearDown(() => database.close());

  OnboardingSaver saver({GarageRepository? garage}) {
    DateTime clock() => testNow;
    final ids = sequentialIds();
    return OnboardingSaver(
      database: database,
      riders: DriftRiderRepository(database, clock: clock, newId: ids),
      garage:
          garage ?? DriftGarageRepository(database, clock: clock, newId: ids),
      readiness: DriftReadinessRepository(database, newId: ids),
      consents: DriftConsentRepository(database, clock: clock, newId: ids),
      clock: clock,
      newId: ids,
    );
  }

  final answers = {
    for (final question in ReadinessQuestion.values) question: false,
  };
  const granted = {
    ConsentKind.healthData: true,
    ConsentKind.location: false,
    ConsentKind.notifications: true,
  };

  Future<int> count(String table) async {
    final row = await database
        .customSelect('SELECT count(*) AS n FROM $table')
        .getSingle();
    return row.read<int>('n');
  }

  test('saves the profile, bike, screening and all three consents', () async {
    await saver().save(
      profile: testRider,
      bikeType: BikeType.gravel,
      readinessAnswers: answers,
      consentChoices: granted,
    );

    expect(await count('rider_profiles'), 1);
    expect(await count('readiness_screenings'), 1);
    expect(await count('consent_records'), 3);
    final bike = await database.select(database.bikes).getSingle();
    expect(bike.bikeType, 'gravel');
    final consents = await database.select(database.consentRecords).get();
    expect(
      {for (final row in consents) row.kind: row.granted},
      {'healthData': true, 'location': false, 'notifications': true},
    );
  });

  test('refuses to store anything without health-data consent', () async {
    await expectLater(
      saver().save(
        profile: testRider,
        bikeType: BikeType.road,
        readinessAnswers: answers,
        consentChoices: {...granted, ConsentKind.healthData: false},
      ),
      throwsA(isA<HealthConsentMissing>()),
    );

    for (final table in ['rider_profiles', 'consent_records', 'bikes']) {
      expect(await count(table), 0, reason: table);
    }
  });

  test('a failure part-way leaves nothing behind', () async {
    await expectLater(
      saver(garage: _BrokenGarage()).save(
        profile: testRider,
        bikeType: BikeType.road,
        readinessAnswers: answers,
        consentChoices: granted,
      ),
      throwsStateError,
    );

    for (final table in [
      'rider_profiles',
      'consent_records',
      'readiness_screenings',
      'bikes',
    ]) {
      expect(await count(table), 0, reason: table);
    }
  });
}
