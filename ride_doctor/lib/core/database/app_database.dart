import 'package:drift/drift.dart';
import 'package:ride_doctor/core/database/tables.dart';

part 'app_database.g.dart';

/// The app's local database. Encrypted at rest - see database_opener.dart.
///
/// Changing any table means: bump [schemaVersion], add a step to [migration],
/// and add a migration test. Never edit a released schema in place: riders'
/// phones already hold the old one.
@DriftDatabase(
  tables: [
    RiderProfiles,
    ReadinessScreenings,
    ConsentRecords,
    Bikes,
    Drivetrains,
    Sensors,
    AppSettingsRows,
    RaceEvents,
    RaceChecklistItems,
    RaceDebriefs,
  ],
)
class AppDatabase extends _$AppDatabase {
  new(super.e);

  @override
  int get schemaVersion => 2;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (migrator) => migrator.createAll(),
    onUpgrade: (migrator, from, to) async {
      // One step per version, each guarded by `from`, so a phone that skipped
      // several releases runs every step it missed, in order.
      if (from < 2) {
        // Version 2 (Phase 2) adds race prep. Only new tables: nothing that
        // version 1 stored is touched.
        await migrator.createTable(raceEvents);
        await migrator.createTable(raceChecklistItems);
        await migrator.createTable(raceDebriefs);
      }
    },
    beforeOpen: (details) async {
      // SQLite ignores foreign keys unless asked, per connection.
      await customStatement('PRAGMA foreign_keys = ON');
      // Overwrite deleted rows with zeros instead of leaving them in the
      // file's free space, so "delete" means the data is gone.
      await customStatement('PRAGMA secure_delete = ON');
    },
  );

  /// Removes every row from every table (the "delete everything" right).
  Future<void> wipe() => transaction(() async {
    for (final table in allTables.toList().reversed) {
      await delete(table).go();
    }
  });
}
