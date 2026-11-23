import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/features/calculators/presentation/my_numbers_screen.dart';
import 'package:ride_doctor/features/onboarding/presentation/onboarding_screen.dart';
import 'package:ride_doctor/features/profile/presentation/edit_bike_screen.dart';
import 'package:ride_doctor/features/profile/presentation/edit_rider_screen.dart';
import 'package:ride_doctor/features/profile/presentation/profile_screen.dart';
import 'package:ride_doctor/features/settings/presentation/privacy_screen.dart';
import 'package:ride_doctor/features/settings/presentation/settings_screen.dart';
import 'package:ride_doctor/features/today/presentation/today_screen.dart';

import '../helpers/pump_app.dart';
import '../helpers/tap_targets.dart';

// PROMPT.md section 11: text scaling to 200%, touch targets >= 48 dp, semantic
// labels. Every screen is visited here, in both languages.
//
// The test surface is deliberately very tall. A scrolling list only builds and
// lays out the rows near the viewport, so on a phone-height surface a row
// that overflows further down would never be laid out and never be caught.
// Making the surface tall lays out everything at once, at phone WIDTH - which
// is the dimension text actually overflows in.
//
// A layout overflow throws while pumping and fails the test, so reaching the
// end of a test is itself the "nothing overflowed" assertion.

const _narrow = Size(320, 9000);
const _normal = Size(412, 9000);

// The steps below find controls by type and position, not by label, so the
// same walk-through works in every language.

Future<void> _type(WidgetTester tester, int index, String text) async {
  await tester.enterText(find.byType(TextFormField).at(index), text);
  await tester.pumpAndSettle();
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Future<void> _next(WidgetTester tester) =>
    _tap(tester, find.byType(FilledButton).last);

Future<void> _back(WidgetTester tester) =>
    _tap(tester, find.byType(BackButton));

/// Walks the four onboarding steps, calling [check] on each one.
Future<void> _walkOnboarding(
  WidgetTester tester,
  Future<void> Function() check,
) async {
  expect(find.byType(OnboardingScreen), findsOneWidget);
  // Step 1: also trigger the validation messages, the longest text there is.
  await _next(tester);
  await check();
  await _type(tester, 0, 'France');
  await _type(tester, 1, '2004');
  await _type(tester, 2, '165');
  await _type(tester, 3, '58.5');
  await _next(tester);

  // Step 2: five bike types, then five goals.
  await _next(tester);
  await check();
  await _tap(tester, find.byType(ChoiceChip).at(0));
  await _tap(tester, find.byType(ChoiceChip).at(5));
  await _type(tester, 0, '1.5');
  await _type(tester, 1, '4');
  await _type(tester, 2, '90');
  await _type(tester, 3, '8');
  await _next(tester);

  // Step 3: seven yes/no pairs. Answer "yes" once so the advice card shows.
  await _next(tester);
  await check();
  await _tap(tester, find.byType(ChoiceChip).at(0));
  for (var question = 1; question < 7; question++) {
    await _tap(tester, find.byType(ChoiceChip).at(question * 2 + 1));
  }
  await check();
  await _next(tester);

  // Step 4: try to finish without consent (shows the error), then consent.
  await _next(tester);
  await check();
  await _tap(tester, find.byType(Switch).first);
  await _next(tester);
  expect(find.byType(TodayScreen), findsOneWidget);
}

/// Visits every screen of the onboarded app, calling [check] on each.
Future<void> _walkApp(
  WidgetTester tester,
  Future<void> Function() check,
) async {
  expect(find.byType(TodayScreen), findsOneWidget);
  await check();

  await _tap(tester, find.byIcon(Icons.speed_outlined));
  expect(find.byType(MyNumbersScreen), findsOneWidget);
  await check();
  // A "Why?" sheet, the densest text in the app.
  await _tap(tester, find.byType(TextButton).first);
  await check();
  await _tap(tester, find.byType(FilledButton).last);

  await _tap(tester, find.byIcon(Icons.person_outline));
  expect(find.byType(ProfileScreen), findsOneWidget);
  await check();

  await _tap(tester, find.byType(FilledButton).at(0));
  expect(find.byType(EditRiderScreen), findsOneWidget);
  await check();
  await _back(tester);

  await _tap(tester, find.byType(FilledButton).at(1));
  expect(find.byType(EditBikeScreen), findsOneWidget);
  await check();
  await _back(tester);

  await _tap(tester, find.byIcon(Icons.today_outlined));
  await _tap(tester, find.byIcon(Icons.settings_outlined));
  expect(find.byType(SettingsScreen), findsOneWidget);
  await check();

  await _tap(tester, find.byIcon(Icons.lock_outline));
  expect(find.byType(PrivacyScreen), findsOneWidget);
  await check();
  // The export dialog, then the delete confirmation.
  await _tap(tester, find.byType(FilledButton).first);
  await check();
  await _tap(tester, find.byType(TextButton).last);
  await _tap(tester, find.byType(OutlinedButton).last);
  await check();
  await _tap(tester, find.byType(TextButton).last);
}

void main() {
  for (final locale in const [Locale('en'), Locale('fil')]) {
    group('$locale', () {
      testWidgets('onboarding does not overflow at 200% text on a narrow '
          'phone', (tester) async {
        await pumpApp(
          tester,
          onboarded: false,
          size: _narrow,
          textScale: 2,
          deviceLocales: [locale],
        );
        await _walkOnboarding(tester, () async {});
      });

      testWidgets('no screen overflows at 200% text on a narrow phone', (
        tester,
      ) async {
        await pumpApp(
          tester,
          size: _narrow,
          textScale: 2,
          deviceLocales: [locale],
          rider: testRider.copyWith(ftpWatts: 180, lthrBpm: 170, inseamMm: 760),
          bike: testBike,
          readinessYes: true,
        );
        await _walkApp(tester, () async {});
      });

      testWidgets('a rider with nothing optional also fits (prompt cards)', (
        tester,
      ) async {
        await pumpApp(
          tester,
          size: _narrow,
          textScale: 2,
          deviceLocales: [locale],
        );
        await _walkApp(tester, () async {});
      });

      testWidgets('onboarding has 48 dp, labelled tap targets', (tester) async {
        final semantics = tester.ensureSemantics();
        await pumpApp(
          tester,
          onboarded: false,
          size: _normal,
          deviceLocales: [locale],
        );
        await _walkOnboarding(tester, () async {
          expect(undersizedTapTargets(tester), isEmpty);
          await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        });
        semantics.dispose();
      });

      testWidgets('every screen has 48 dp, labelled tap targets', (
        tester,
      ) async {
        final semantics = tester.ensureSemantics();
        await pumpApp(
          tester,
          size: _normal,
          deviceLocales: [locale],
          rider: testRider.copyWith(ftpWatts: 180, inseamMm: 760),
          bike: testBike,
        );
        await _walkApp(tester, () async {
          expect(undersizedTapTargets(tester), isEmpty);
          await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        });
        semantics.dispose();
      });
    });
  }
}
