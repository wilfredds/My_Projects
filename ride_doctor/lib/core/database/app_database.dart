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
  ],
)
class AppDatabase extends _$AppDatabase {
  new(super.executor);

  @override
  int get schemaVersion => 1;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (migrator) => migrator.createAll(),
    onUpgrade: (migrator, from, to) async {
      // Version 1 is the first schema, so there is nothing to upgrade from
      // yet. Each future version adds an `if (from < n)` step here.
    },
    beforeOpen: (details) async {
      // SQLite ignores foreign keys unless asked, per connection.
      await customStatement('PRAGMA foreign_keys = ON');
    },
  );

  /// Removes every row from every table (the "delete everything" right).
  Future<void> wipe() => transaction(() async {
    for (final table in allTables.toList().reversed) {
      await delete(table).go();
    }
  });
}
