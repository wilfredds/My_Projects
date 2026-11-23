import 'package:ride_doctor/core/database/app_database.dart';

/// Everything the app has stored, as plain JSON-ready data - the rider's
/// right to a copy of their data (PROMPT.md section 10).
///
/// It reads every table generically rather than listing them, so a table
/// added in a later phase is included automatically and cannot be forgotten.
Future<Map<String, Object?>> exportAllData(
  AppDatabase database, {
  required DateTime exportedAt,
}) async {
  final tables = <String, Object?>{};
  for (final table in database.allTables) {
    final rows = await database
        .customSelect('SELECT * FROM "${table.actualTableName}"')
        .get();
    tables[table.actualTableName] = [for (final row in rows) row.data];
  }
  return {
    'app': 'Ride Doctor',
    'exportedAt': exportedAt.toUtc().toIso8601String(),
    'schemaVersion': database.schemaVersion,
    'tables': tables,
  };
}
