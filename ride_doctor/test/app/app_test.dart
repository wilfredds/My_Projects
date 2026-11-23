import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/app.dart';
import 'package:ride_doctor/app/startup/startup_screens.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/core/database/database_providers.dart';
import 'package:ride_doctor/features/calculators/presentation/my_numbers_screen.dart';
import 'package:ride_doctor/features/onboarding/presentation/onboarding_screen.dart';
import 'package:ride_doctor/features/profile/presentation/profile_screen.dart';
import 'package:ride_doctor/features/settings/data/drift_settings_repository.dart';
import 'package:ride_doctor/features/settings/domain/app_settings.dart';
import 'package:ride_doctor/features/settings/presentation/settings_screen.dart';
import 'package:ride_doctor/features/today/presentation/today_screen.dart';

import '../helpers/pump_app.dart';
import '../helpers/test_database.dart';

ThemeData themeOf(WidgetTester tester, Type screen) =>
    Theme.of(tester.element(find.byType(screen)));

Future<void> openSettings(WidgetTester tester) async {
  await tester.tap(find.byIcon(Icons.settings_outlined));
  await tester.pumpAndSettle();
}

void main() {
  group('launch', () {
    testWidgets('a first launch opens on onboarding', (tester) async {
      await pumpApp(tester, onboarded: false);

      expect(find.byType(OnboardingScreen), findsOneWidget);
      expect(find.text('Step 1 of 4'), findsOneWidget);
    });

    testWidgets('an onboarded rider opens on Today, greeted by name', (
      tester,
    ) async {
      await pumpApp(tester);

      expect(find.byType(TodayScreen), findsOneWidget);
      expect(find.text('Hi, France'), findsOneWidget);
    });

    testWidgets('follows the device theme by default', (tester) async {
      tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
      await pumpApp(tester);

      expect(themeOf(tester, TodayScreen).brightness, Brightness.dark);
    });

    testWidgets('a phone set to Filipino starts in Filipino', (tester) async {
      await pumpApp(tester, deviceLocales: const [Locale('fil', 'PH')]);

      expect(find.text('Kumusta, France'), findsOneWidget);
    });

    testWidgets('a phone reporting the legacy "tl" code starts in Filipino', (
      tester,
    ) async {
      await pumpApp(tester, deviceLocales: const [Locale('tl', 'PH')]);

      expect(find.text('Kumusta, France'), findsOneWidget);
    });

    testWidgets('an unsupported device language falls back to English', (
      tester,
    ) async {
      await pumpApp(tester, deviceLocales: const [Locale('ja', 'JP')]);

      expect(find.text('Hi, France'), findsOneWidget);
    });
  });

  group('startup', () {
    testWidgets('shows a starting screen while the database opens', (
      tester,
    ) async {
      final opening = Completer<AppDatabase>();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appDatabaseProvider.overrideWith((ref) => opening.future),
          ],
          child: const RideDoctorApp(),
        ),
      );
      // Not pumpAndSettle: the progress indicator never stops animating.
      await tester.pump();
      await tester.pump();

      expect(find.byType(StartingScreen), findsOneWidget);
      expect(find.text('Opening your data…'), findsOneWidget);

      // Once it opens (to an empty database), the app moves on by itself.
      final database = newTestDatabase();
      addTearDown(database.close);
      opening.complete(database);
      await tester.pumpAndSettle();

      expect(find.byType(OnboardingScreen), findsOneWidget);
    });

    testWidgets('an unreadable database shows the error screen, and Try '
        'again re-opens it', (tester) async {
      final database = newTestDatabase();
      addTearDown(database.close);
      var attempts = 0;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            appDatabaseProvider.overrideWith((ref) async {
              attempts++;
              if (attempts == 1) throw StateError('file is not a database');
              return database;
            }),
          ],
          child: const RideDoctorApp(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(StartupErrorScreen), findsOneWidget);
      expect(find.text('Your data could not be opened'), findsOneWidget);

      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();

      expect(attempts, 2);
      expect(find.byType(OnboardingScreen), findsOneWidget);
    });
  });

  group('navigation', () {
    testWidgets('the bottom bar switches between the three tabs', (
      tester,
    ) async {
      await pumpApp(tester);

      await tester.tap(find.text('My Numbers'));
      await tester.pumpAndSettle();
      expect(find.byType(MyNumbersScreen), findsOneWidget);

      await tester.tap(find.text('Profile'));
      await tester.pumpAndSettle();
      expect(find.byType(ProfileScreen), findsOneWidget);

      await tester.tap(find.text('Today').last);
      await tester.pumpAndSettle();
      expect(find.text('Hi, France'), findsOneWidget);
    });
  });

  group('settings', () {
    testWidgets('choosing Dark switches the theme and is stored', (
      tester,
    ) async {
      final database = await pumpApp(tester);
      await openSettings(tester);
      expect(themeOf(tester, SettingsScreen).brightness, Brightness.light);

      await tester.tap(find.text('Dark'));
      await tester.pumpAndSettle();

      expect(themeOf(tester, SettingsScreen).brightness, Brightness.dark);
      final row = await database.select(database.appSettingsRows).getSingle();
      expect(row.themeMode, 'dark');
    });

    testWidgets('choosing Filipino relabels the app, and it sticks when '
        'navigating back', (tester) async {
      await pumpApp(tester);
      await openSettings(tester);

      await tester.tap(find.text('Filipino'));
      await tester.pumpAndSettle();
      expect(find.text('Mga Setting'), findsOneWidget);
      expect(find.text('Wika'), findsOneWidget);

      // Not tester.pageBack(): that helper looks for the back button class
      // from the deprecated flutter/material.dart, which we do not use.
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('Kumusta, France'), findsOneWidget);
    });

    testWidgets('"Match device" returns to the device language', (
      tester,
    ) async {
      await pumpApp(tester);
      await openSettings(tester);
      await tester.tap(find.text('Filipino'));
      await tester.pumpAndSettle();

      // Two rows share this label in Filipino (theme and language); the
      // language one is second.
      await tester.tap(find.text('Sundin ang device').last);
      await tester.pumpAndSettle();

      expect(find.text('Settings'), findsOneWidget);
    });

    testWidgets('choosing imperial shows weight in pounds', (tester) async {
      await pumpApp(tester);
      await openSettings(tester);
      await tapText(tester, 'Imperial (lb, in, mi)');
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Profile'));
      await tester.pumpAndSettle();

      // 58.5 kg is 129 lb; 165 cm is 65 in.
      expect(find.text('129 lb'), findsOneWidget);
      expect(find.text('65 in'), findsOneWidget);
    });

    testWidgets('stored settings are applied on the next launch', (
      tester,
    ) async {
      await pumpApp(
        tester,
        prepare: (database) =>
            DriftSettingsRepository(database, clock: () => testNow).save(
              const AppSettings(
                themeMode: AppThemeMode.dark,
                languageCode: 'fil',
              ),
            ),
      );

      expect(find.text('Kumusta, France'), findsOneWidget);
      expect(themeOf(tester, TodayScreen).brightness, Brightness.dark);
    });
  });
}
