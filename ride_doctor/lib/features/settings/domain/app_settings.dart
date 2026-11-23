import 'package:freezed_annotation/freezed_annotation.dart';

part 'app_settings.freezed.dart';

/// How the app chooses between its light and dark themes.
///
/// This mirrors Flutter's `ThemeMode` on purpose instead of reusing it: the
/// domain layer must not import Flutter (test/architecture enforces this), so
/// that settings can be stored, exported and synced without a UI framework.
enum AppThemeMode { system, light, dark }

/// Which units numbers are typed and shown in. Storage is always metric.
enum UnitSystem { metric, imperial }

/// User preferences that change how the app looks and reads.
@freezed
abstract class AppSettings with _$AppSettings {
  const factory({
    @Default(AppThemeMode.system) AppThemeMode themeMode,
    @Default(UnitSystem.metric) UnitSystem unitSystem,

    /// A supported language code (`en`, `fil`), or null to follow the device.
    String? languageCode,
  }) = _AppSettings;
}
