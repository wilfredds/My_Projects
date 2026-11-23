import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/features/dev/presentation/design_preview_screen.dart';
import 'package:ride_doctor/features/settings/presentation/settings_screen.dart';
import 'package:ride_doctor/features/today/presentation/today_screen.dart';

import '../helpers/pump_app.dart';
import '../helpers/tap_targets.dart';

ThemeData themeOf(WidgetTester tester, Type screen) =>
    Theme.of(tester.element(find.byType(screen)));

Future<void> openSettings(WidgetTester tester) async {
  await tester.tap(find.byIcon(Icons.settings_outlined));
  await tester.pumpAndSettle();
}

Future<void> openDesignPreview(WidgetTester tester) async {
  await openSettings(tester);
  await tester.tap(find.byIcon(Icons.palette_outlined));
  await tester.pumpAndSettle();
}

void main() {
  group('launch', () {
    testWidgets('opens on the Today placeholder in English', (tester) async {
      await pumpApp(tester);

      expect(find.byType(TodayScreen), findsOneWidget);
      expect(find.text('Today'), findsOneWidget);
      expect(find.text('Nothing planned yet'), findsOneWidget);
    });

    testWidgets('follows the device theme by default', (tester) async {
      tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
      await pumpApp(tester);

      expect(themeOf(tester, TodayScreen).brightness, Brightness.dark);
    });

    testWidgets('a phone set to Filipino starts in Filipino', (tester) async {
      await pumpApp(tester, deviceLocales: const [Locale('fil', 'PH')]);

      expect(find.text('Ngayon'), findsOneWidget);
    });

    testWidgets('a phone reporting the legacy "tl" code starts in Filipino', (
      tester,
    ) async {
      await pumpApp(tester, deviceLocales: const [Locale('tl', 'PH')]);

      expect(find.text('Ngayon'), findsOneWidget);
    });

    testWidgets('an unsupported device language falls back to English', (
      tester,
    ) async {
      await pumpApp(tester, deviceLocales: const [Locale('ja', 'JP')]);

      expect(find.text('Today'), findsOneWidget);
    });
  });

  group('settings', () {
    testWidgets('choosing Dark switches the theme', (tester) async {
      await pumpApp(tester);
      await openSettings(tester);
      expect(themeOf(tester, SettingsScreen).brightness, Brightness.light);

      await tester.tap(find.text('Dark'));
      await tester.pumpAndSettle();

      expect(themeOf(tester, SettingsScreen).brightness, Brightness.dark);
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
      expect(find.text('Ngayon'), findsOneWidget);
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
  });

  // PROMPT.md section 11: text scaling to 200%, touch targets >= 48 dp,
  // semantic labels. A layout overflow throws inside pumpApp and fails the
  // test, so "it pumped" is itself the no-overflow assertion.
  group('accessibility', () {
    const smallPhone = Size(320, 568);

    for (final locale in const [Locale('en'), Locale('fil')]) {
      testWidgets('no screen overflows at 200% text on a small phone '
          '($locale)', (tester) async {
        await pumpApp(
          tester,
          size: smallPhone,
          textScale: 2,
          deviceLocales: [locale],
        );
        expect(find.byType(TodayScreen), findsOneWidget);

        await openSettings(tester);
        expect(find.byType(SettingsScreen), findsOneWidget);

        // The list builds rows lazily, so first scroll until the row
        // exists, then bring all of it on screen before tapping.
        final designPreviewRow = find.byIcon(Icons.palette_outlined);
        await tester.scrollUntilVisible(designPreviewRow, 200);
        await tester.ensureVisible(designPreviewRow);
        await tester.pumpAndSettle();
        await tester.tap(designPreviewRow);
        await tester.pumpAndSettle();
        expect(find.byType(DesignPreviewScreen), findsOneWidget);
        await tester.drag(find.byType(ListView), const Offset(0, -3000));
        await tester.pumpAndSettle();
      });
    }

    testWidgets('every screen has 48 dp tap targets with labels', (
      tester,
    ) async {
      final semantics = tester.ensureSemantics();
      await pumpApp(tester);
      expect(undersizedTapTargets(tester), isEmpty);
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));

      await openSettings(tester);
      expect(undersizedTapTargets(tester), isEmpty);
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));

      await tester.tap(find.byIcon(Icons.palette_outlined));
      await tester.pumpAndSettle();
      expect(undersizedTapTargets(tester), isEmpty);
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
      semantics.dispose();
    });
  });
}
