import 'package:drift/drift.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/core/database/enum_text.dart';
import 'package:ride_doctor/features/settings/domain/app_settings.dart';
import 'package:ride_doctor/features/settings/domain/settings_repository.dart';

final class DriftSettingsRepository implements SettingsRepository {
  const new(this._db, {required this.clock});

  /// There is only ever one settings row, so it has a fixed id.
  static const _rowId = 'app';

  final AppDatabase _db;
  final DateTime Function() clock;

  @override
  Future<AppSettings> load() async {
    final row = await _db.select(_db.appSettingsRows).getSingleOrNull();
    if (row == null) return const AppSettings();
    return AppSettings(
      themeMode:
          enumFromName(AppThemeMode.values, row.themeMode) ??
          AppThemeMode.system,
      unitSystem:
          enumFromName(UnitSystem.values, row.unitSystem) ?? UnitSystem.metric,
      languageCode: row.languageCode,
    );
  }

  @override
  Future<void> save(AppSettings settings) {
    final now = clock();
    return _db
        .into(_db.appSettingsRows)
        .insert(
          AppSettingsRowsCompanion.insert(
            id: _rowId,
            createdAt: now,
            updatedAt: now,
            themeMode: settings.themeMode.name,
            languageCode: Value(settings.languageCode),
            unitSystem: settings.unitSystem.name,
          ),
          // Insert, or if the row exists update everything except createdAt.
          onConflict: DoUpdate(
            (old) => AppSettingsRowsCompanion(
              updatedAt: Value(now),
              themeMode: Value(settings.themeMode.name),
              languageCode: Value(settings.languageCode),
              unitSystem: Value(settings.unitSystem.name),
            ),
          ),
        );
  }
}
