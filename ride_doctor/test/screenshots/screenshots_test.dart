// Renders the app's screens to PNG files, with the real fonts, so the UI can
// be reviewed without a phone or emulator. Not part of the normal test run:
//
//   flutter test test/screenshots --dart-define=SCREENSHOTS=true --update-goldens
//
// The images land in test/screenshots/goldens/ (git-ignored). They are for
// looking at, not for comparing: pixel-comparison tests break on every
// harmless rendering difference between machines, so we do not gate on them.
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../helpers/pump_app.dart';

const _enabled = bool.fromEnvironment('SCREENSHOTS');

Future<void> _loadFont(String family, List<String> files) async {
  final loader = FontLoader(family);
  for (final path in files) {
    final bytes = await File(path).readAsBytes();
    loader.addFont(Future.value(ByteData.sublistView(bytes)));
  }
  await loader.load();
}

/// Tests render text as solid boxes unless real fonts are loaded.
Future<void> _loadFonts() async {
  await _loadFont('Barlow', [
    'assets/fonts/Barlow-Regular.ttf',
    'assets/fonts/Barlow-Medium.ttf',
    'assets/fonts/Barlow-SemiBold.ttf',
  ]);
  await _loadFont('Barlow Condensed', [
    'assets/fonts/BarlowCondensed-SemiBold.ttf',
    'assets/fonts/BarlowCondensed-Bold.ttf',
  ]);
  final fontCache =
      '${Platform.environment['FLUTTER_ROOT']}/bin/cache/artifacts/'
      'material_fonts';
  await _loadFont('MaterialIcons', ['$fontCache/MaterialIcons-Regular.otf']);
}

Future<void> _shoot(WidgetTester tester, String name) => expectLater(
  find.byType(MaterialApp),
  matchesGoldenFile('goldens/$name.png'),
);

Future<void> _tapIcon(WidgetTester tester, IconData icon) async {
  await tester.tap(find.byIcon(icon));
  await tester.pumpAndSettle();
}

void main() {
  if (!_enabled) {
    test('screenshots are skipped unless SCREENSHOTS=true', () {});
    return;
  }

  setUpAll(_loadFonts);

  final fullRider = testRider.copyWith(
    ftpWatts: 180,
    restingHrBpm: 52,
    inseamMm: 760,
  );

  for (final brightness in Brightness.values) {
    final mode = brightness.name;

    testWidgets('onboarding ($mode)', (tester) async {
      tester.platformDispatcher.platformBrightnessTestValue = brightness;
      await pumpApp(tester, onboarded: false);
      await _shoot(tester, 'onboarding-1-about-$mode');

      await enterField(tester, 'What should we call you?', 'France');
      await enterField(tester, 'Birth year', '2004');
      await enterField(tester, 'Height', '165');
      await enterField(tester, 'Weight', '58.5');
      await tapText(tester, 'Next');
      await tapText(tester, 'Road');
      await tapText(tester, 'Race faster');
      await enterField(tester, 'Years riding', '1.5');
      await enterField(tester, 'Rides per week', '4');
      await enterField(tester, 'Typical ride length', '90');
      await enterField(tester, 'Hours you can ride per week', '8');
      await _shoot(tester, 'onboarding-2-riding-$mode');
      await tapText(tester, 'Next');
      await tester.tap(find.text('Yes').first);
      await tester.pumpAndSettle();
      await _shoot(tester, 'onboarding-3-readiness-$mode');
    });

    testWidgets('today and profile ($mode)', (tester) async {
      tester.platformDispatcher.platformBrightnessTestValue = brightness;
      await pumpApp(tester, rider: fullRider, bike: testBike);
      await _shoot(tester, 'today-$mode');
      await _tapIcon(tester, Icons.person_outline);
      await _shoot(tester, 'profile-$mode');
    });

    testWidgets('my numbers, full length ($mode)', (tester) async {
      tester.platformDispatcher.platformBrightnessTestValue = brightness;
      await pumpApp(
        tester,
        size: const Size(412, 4300),
        rider: fullRider,
        bike: testBike,
      );
      await _tapIcon(tester, Icons.speed_outlined);
      await _shoot(tester, 'numbers-full-$mode');
    });

    testWidgets('why sheet ($mode)', (tester) async {
      tester.platformDispatcher.platformBrightnessTestValue = brightness;
      await pumpApp(tester);
      await _tapIcon(tester, Icons.speed_outlined);
      await tester.tap(find.text('Why?').first);
      await tester.pumpAndSettle();
      await _shoot(tester, 'why-$mode');
    });
  }

  testWidgets('today for a brand-new rider, in Filipino', (tester) async {
    await pumpApp(
      tester,
      deviceLocales: const [Locale('fil', 'PH')],
      readinessYes: true,
    );
    await _shoot(tester, 'today-new-rider-fil');
  });

  testWidgets('bike editor, full length', (tester) async {
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    await pumpApp(tester, size: const Size(412, 2600), bike: testBike);
    await _tapIcon(tester, Icons.person_outline);
    await tapText(tester, 'Edit bike details');
    await _shoot(tester, 'edit-bike-dark');
  });

  testWidgets('privacy', (tester) async {
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    await pumpApp(tester);
    await _tapIcon(tester, Icons.settings_outlined);
    await tapText(tester, 'Privacy and your data');
    await _shoot(tester, 'privacy-dark');
  });
}
