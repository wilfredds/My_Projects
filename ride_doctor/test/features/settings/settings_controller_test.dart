import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/features/settings/domain/app_settings.dart';
import 'package:ride_doctor/features/settings/presentation/settings_controller.dart';

void main() {
  late ProviderContainer container;

  setUp(() {
    container = ProviderContainer();
    addTearDown(container.dispose);
  });

  AppSettings read() => container.read(settingsControllerProvider);
  SettingsController controller() =>
      container.read(settingsControllerProvider.notifier);

  test('defaults to following the device for theme and language', () {
    expect(read(), const AppSettings());
    expect(read().themeMode, AppThemeMode.system);
    expect(read().languageCode, isNull);
  });

  test('setThemeMode changes only the theme', () {
    controller()
      ..setLanguageCode('fil')
      ..setThemeMode(AppThemeMode.dark);

    expect(
      read(),
      const AppSettings(themeMode: AppThemeMode.dark, languageCode: 'fil'),
    );
  });

  test('setLanguageCode(null) clears an explicit language', () {
    controller()
      ..setLanguageCode('fil')
      ..setLanguageCode(null);

    expect(read().languageCode, isNull);
  });

  test('listeners are notified only when the value really changes', () {
    var notifications = 0;
    container.listen(settingsControllerProvider, (_, _) => notifications++);

    controller().setThemeMode(AppThemeMode.dark);
    controller().setThemeMode(AppThemeMode.dark);

    expect(notifications, 1);
  });

  test('AppSettings has value equality', () {
    const a = AppSettings(themeMode: AppThemeMode.light, languageCode: 'en');
    const b = AppSettings(themeMode: AppThemeMode.light, languageCode: 'en');

    expect(a, b);
    expect(a.hashCode, b.hashCode);
    expect(a, isNot(const AppSettings(languageCode: 'en')));
  });
}
