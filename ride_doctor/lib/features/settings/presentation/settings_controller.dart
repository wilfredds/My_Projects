import 'dart:async';

import 'package:ride_doctor/features/settings/data/settings_providers.dart';
import 'package:ride_doctor/features/settings/domain/app_settings.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'settings_controller.g.dart';

/// Owns the current [AppSettings] and is the only place allowed to change it.
///
/// It starts from the defaults so the very first frame can be painted without
/// waiting for the database, then swaps in the stored settings a moment later.
///
/// keepAlive: settings must survive every screen being closed; the default
/// auto-dispose behaviour would reset them when nothing is listening.
@Riverpod(keepAlive: true)
class SettingsController extends _$SettingsController {
  /// Set once the rider changes something, so a slow initial load can never
  /// overwrite a choice they just made.
  bool _changedByUser = false;

  @override
  AppSettings build() {
    _changedByUser = false;
    unawaited(_load());
    return const AppSettings();
  }

  Future<void> _load() async {
    try {
      final repository = await ref.read(settingsRepositoryProvider.future);
      final stored = await repository.load();
      if (ref.mounted && !_changedByUser) state = stored;
    } on Object {
      // The database could not be opened. The app's startup screen reports
      // that; here the defaults simply stay in place.
    }
  }

  Future<void> _update(AppSettings next) async {
    _changedByUser = true;
    state = next;
    final repository = await ref.read(settingsRepositoryProvider.future);
    await repository.save(next);
  }

  Future<void> setThemeMode(AppThemeMode themeMode) =>
      _update(state.copyWith(themeMode: themeMode));

  /// Pass null to follow the device language.
  Future<void> setLanguageCode(String? languageCode) =>
      _update(state.copyWith(languageCode: languageCode));

  Future<void> setUnitSystem(UnitSystem unitSystem) =>
      _update(state.copyWith(unitSystem: unitSystem));
}
