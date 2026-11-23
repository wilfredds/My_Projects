import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/features/profile/data/drift_rider_repository.dart';
import 'package:ride_doctor/features/settings/data/data_export.dart';
import 'package:ride_doctor/features/settings/data/drift_settings_repository.dart';
import 'package:ride_doctor/features/settings/domain/app_settings.dart';

import '../../helpers/test_database.dart';
import '../profile/rider_repository_test.dart' show essentials;

void main() {
  late AppDatabase database;
  late FakeClock clock;
  late DriftSettingsRepository repository;

  setUp(() {
    database = newTestDatabase();
    clock = FakeClock();
    repository = DriftSettingsRepository(database, clock: clock.call);
  });

  tearDown(() => database.close());

  test('defaults when nothing was saved', () async {
    expect(await repository.load(), const AppSettings());
  });

  test('settings round-trip', () async {
    const settings = AppSettings(
      themeMode: AppThemeMode.dark,
      unitSystem: UnitSystem.imperial,
      languageCode: 'fil',
    );
    await repository.save(settings);

    expect(await repository.load(), settings);
  });

  test('saving twice keeps one row and its creation time', () async {
    await repository.save(const AppSettings(themeMode: AppThemeMode.dark));
    clock.advance(const Duration(days: 1));
    await repository.save(const AppSettings(themeMode: AppThemeMode.light));

    final row = await database.select(database.appSettingsRows).getSingle();
    expect(row.themeMode, 'light');
    expect(row.createdAt, DateTime.utc(2026, 11, 23, 8));
    expect(row.updatedAt, DateTime.utc(2026, 11, 24, 8));
  });

  test('clearing the language stores null', () async {
    await repository.save(const AppSettings(languageCode: 'fil'));
    await repository.save(const AppSettings());

    expect((await repository.load()).languageCode, isNull);
  });

  test('unknown stored values fall back to defaults', () async {
    await repository.save(const AppSettings());
    await database.customStatement(
      "UPDATE app_settings SET theme_mode = 'sepia', unit_system = 'cubits'",
    );

    expect(await repository.load(), const AppSettings());
  });

  group('exportAllData', () {
    test('includes every table, even empty ones', () async {
      final export = await exportAllData(database, exportedAt: clock.now);
      final tables = export['tables']! as Map<String, Object?>;

      expect(
        tables.keys,
        containsAll(database.allTables.map((table) => table.actualTableName)),
      );
      expect(export['schemaVersion'], 1);
      expect(export['exportedAt'], '2026-11-23T08:00:00.000Z');
    });

    test('contains what was stored', () async {
      await DriftRiderRepository(
        database,
        clock: clock.call,
        newId: sequentialIds(),
      ).saveProfile(essentials);
      await repository.save(const AppSettings(languageCode: 'fil'));

      final export = await exportAllData(database, exportedAt: clock.now);
      final tables = export['tables']! as Map<String, Object?>;
      final riders = tables['rider_profiles']! as List<Object?>;
      final rider = riders.single! as Map<String, Object?>;

      expect(rider['display_name'], 'France');
      expect(rider['weight_kg'], 58.5);
      expect(tables['app_settings']! as List<Object?>, hasLength(1));
    });
  });

  test('wipe empties every table', () async {
    await DriftRiderRepository(
      database,
      clock: clock.call,
      newId: sequentialIds(),
    ).saveProfile(essentials);
    await repository.save(const AppSettings(languageCode: 'fil'));

    await database.wipe();

    for (final table in database.allTables) {
      final rows = await database
          .customSelect('SELECT * FROM "${table.actualTableName}"')
          .get();
      expect(rows, isEmpty, reason: table.actualTableName);
    }
  });
}
