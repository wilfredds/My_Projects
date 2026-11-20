import 'package:ride_doctor/features/settings/domain/app_settings.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'settings_controller.g.dart';

/// Owns the current [AppSettings] and is the only place allowed to change it.
///
/// keepAlive: settings must survive every screen being closed; the default
/// auto-dispose behaviour would reset them when nothing is listening.
@Riverpod(keepAlive: true)
class SettingsController extends _$SettingsController {
  @override
  AppSettings build() => const AppSettings();

  void setThemeMode(AppThemeMode themeMode) {
    state = state.withThemeMode(themeMode);
  }

  /// Pass null to follow the device language.
  void setLanguageCode(String? languageCode) {
    state = state.withLanguageCode(languageCode);
  }
}
