import 'package:meta/meta.dart';

/// How the app chooses between its light and dark themes.
///
/// This mirrors Flutter's `ThemeMode` on purpose instead of reusing it: the
/// domain layer must not import Flutter (test/architecture enforces this), so
/// that settings can be stored, exported and synced without a UI framework.
enum AppThemeMode { system, light, dark }

/// User preferences that change how the app looks and reads.
///
/// Held in memory only for now. Phase 1 persists it in the encrypted
/// `app_settings` table.
@immutable
final class AppSettings {
  const new({this.themeMode = AppThemeMode.system, this.languageCode});

  final AppThemeMode themeMode;

  /// A supported language code (`en`, `fil`), or null to follow the device.
  final String? languageCode;

  AppSettings withThemeMode(AppThemeMode themeMode) =>
      AppSettings(themeMode: themeMode, languageCode: languageCode);

  // A dedicated method rather than a generic copyWith: with a nullable field,
  // copyWith(languageCode: null) cannot tell "set to null" from "unchanged".
  AppSettings withLanguageCode(String? languageCode) =>
      AppSettings(themeMode: themeMode, languageCode: languageCode);

  @override
  bool operator ==(Object other) =>
      other is AppSettings &&
      other.themeMode == themeMode &&
      other.languageCode == languageCode;

  @override
  int get hashCode => Object.hash(themeMode, languageCode);
}
