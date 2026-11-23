import 'package:drift/drift.dart' hide isNull;
import 'package:drift/native.dart';
import 'package:drift_dev/api/migrations_native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/database/app_database.dart';

import '../../generated_migrations/schema.dart';

/// Checks that upgrading an old database gives exactly the schema a fresh
/// install has, and keeps the rider's data.
///
/// Every released schema is frozen in drift_schemas/ as JSON. To add a
/// version: change the tables, bump `schemaVersion`, write the upgrade step,
/// then run
///   dart run drift_dev schema dump lib/core/database/app_database.dart drift_schemas/
///   dart run drift_dev schema generate drift_schemas/ test/generated_migrations/
/// and extend the tests below. Riders' phones already hold the old schema;
/// a wrong migration loses real data, so this is not optional.
void main() {
  late SchemaVerifier verifier;

  setUpAll(() => verifier = SchemaVerifier(GeneratedHelper()));

  test('the frozen snapshots cover every version up to the current one', () {
    final database = AppDatabase(DatabaseConnection(NativeDatabase.memory()));
    addTearDown(database.close);
    expect(GeneratedHelper.versions.last, database.schemaVersion);
  });

  for (final from in GeneratedHelper.versions) {
    for (final to in GeneratedHelper.versions.where((v) => v > from)) {
      test('upgrading v$from to v$to matches a fresh v$to install', () async {
        final connection = await verifier.startAt(from);
        final database = AppDatabase(connection);
        addTearDown(database.close);

        await verifier.migrateAndValidate(database, to);
      });
    }
  }

  test(
    'upgrading from v1 keeps the rider and adds empty race tables',
    () async {
      final schema = await verifier.schemaAt(1);

      // A version 1 database with a rider in it, written with raw SQL exactly
      // as the version 1 app would have left it.
      schema.rawDatabase.execute('''
      INSERT INTO rider_profiles (
        id, created_at, updated_at, display_name, birth_year, height_cm,
        weight_kg, years_riding, rides_per_week, typical_ride_minutes,
        hours_per_week, goal
      ) VALUES (
        'r1', '2026-11-23T08:00:00.000Z', '2026-11-23T08:00:00.000Z',
        'France', 2004, 165, 58.5, 1.5, 4, 90, 8, 'raceFaster'
      )
    ''');

      final database = AppDatabase(schema.newConnection());
      addTearDown(database.close);
      await verifier.migrateAndValidate(database, 2);

      final rider = await database.select(database.riderProfiles).getSingle();
      expect(rider.displayName, 'France');
      expect(rider.weightKg, 58.5);
      expect(await database.select(database.raceEvents).get(), isEmpty);
      expect(await database.select(database.raceDebriefs).get(), isEmpty);
    },
  );
}
