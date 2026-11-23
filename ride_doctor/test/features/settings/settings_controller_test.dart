import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/core/database/database_providers.dart';
import 'package:ride_doctor/features/settings/data/drift_settings_repository.dart';
import 'package:ride_doctor/features/settings/domain/app_settings.dart';
import 'package:ride_doctor/features/settings/presentation/settings_controller.dart';

import '../../helpers/test_database.dart';

void main() {
  late AppDatabase database;

  setUp(() => database = newTestDatabase());
  tearDown(() => database.close());

  ProviderContainer newContainer() {
    final container = ProviderContainer(
      overrides: [appDatabaseProvider.overrideWith((ref) async => database)],
    );
    addTearDown(container.dispose);
    return container;
  }

  test('starts from the defaults so the first frame can paint', () {
    expect(
      newContainer().read(settingsControllerProvider),
      const AppSettings(),
    );
  });

  test('then loads what was stored', () async {
    await DriftSettingsRepository(database, clock: DateTime.now).save(
      const AppSettings(themeMode: AppThemeMode.dark, languageCode: 'fil'),
    );
    final container = newContainer()..read(settingsControllerProvider);
    await pumpEventQueue();

    expect(
      container.read(settingsControllerProvider),
      const AppSettings(themeMode: AppThemeMode.dark, languageCode: 'fil'),
    );
  });

  test('each setter changes only its own field, and persists', () async {
    final container = newContainer();
    final controller = container.read(settingsControllerProvider.notifier);
    await pumpEventQueue();

    await controller.setLanguageCode('fil');
    await controller.setThemeMode(AppThemeMode.dark);
    await controller.setUnitSystem(UnitSystem.imperial);

    const expected = AppSettings(
      themeMode: AppThemeMode.dark,
      unitSystem: UnitSystem.imperial,
      languageCode: 'fil',
    );
    expect(container.read(settingsControllerProvider), expected);
    expect(
      await DriftSettingsRepository(database, clock: DateTime.now).load(),
      expected,
    );
  });

  test('setLanguageCode(null) clears an explicit language', () async {
    final container = newContainer();
    final controller = container.read(settingsControllerProvider.notifier);

    await controller.setLanguageCode('fil');
    await controller.setLanguageCode(null);

    expect(container.read(settingsControllerProvider).languageCode, isNull);
  });

  test('a change made before the stored settings arrive is not lost', () async {
    await DriftSettingsRepository(
      database,
      clock: DateTime.now,
    ).save(const AppSettings(themeMode: AppThemeMode.dark));
    final container = newContainer();

    // No pumpEventQueue first: the initial load is still in flight.
    await container
        .read(settingsControllerProvider.notifier)
        .setThemeMode(AppThemeMode.light);
    await pumpEventQueue();

    expect(
      container.read(settingsControllerProvider).themeMode,
      AppThemeMode.light,
    );
  });

  test('listeners are notified only when the value really changes', () async {
    final container = newContainer();
    final controller = container.read(settingsControllerProvider.notifier);
    await pumpEventQueue();
    var notifications = 0;
    container.listen(settingsControllerProvider, (_, _) => notifications++);

    await controller.setThemeMode(AppThemeMode.dark);
    await controller.setThemeMode(AppThemeMode.dark);

    expect(notifications, 1);
  });

  test('if the database cannot be opened, the defaults stay', () async {
    final container = ProviderContainer(
      overrides: [
        appDatabaseProvider.overrideWith(
          (ref) async => throw StateError('unreadable'),
        ),
      ],
    );
    addTearDown(container.dispose);

    container.read(settingsControllerProvider);
    await pumpEventQueue();

    expect(container.read(settingsControllerProvider), const AppSettings());
  });
}
