import 'package:ride_doctor/features/settings/domain/app_settings.dart';

abstract interface class SettingsRepository {
  /// The stored settings, or the defaults if none were saved yet.
  Future<AppSettings> load();

  Future<void> save(AppSettings settings);
}
