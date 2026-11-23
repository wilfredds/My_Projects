import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/widgets/confidence_chip.dart';
import 'package:ride_doctor/app/widgets/heat_badge.dart';
import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/heat_index.dart';
import 'package:ride_doctor/features/profile/domain/rider_profile.dart';

import '../../helpers/pump_app.dart';

Future<void> openNumbers(WidgetTester tester) async {
  await tester.tap(find.text('My Numbers'));
  await tester.pumpAndSettle();
}

/// Scrolls the My Numbers list until [finder] is built and on screen.
Future<void> reveal(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(
    finder,
    300,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
}

Future<void> tapTimes(WidgetTester tester, String tooltip, int times) async {
  final button = find.byWidgetPredicate(
    (widget) => widget is IconButton && widget.tooltip == tooltip,
  );
  await reveal(tester, button);
  for (var i = 0; i < times; i++) {
    await tester.tap(button);
    await tester.pumpAndSettle();
  }
}

/// A large calculated value. It is one rich text - number and unit in
/// different sizes - so a plain text finder does not see it.
Finder bigNumber(String valueAndUnit) =>
    find.text(valueAndUnit, findRichText: true);

void main() {
  group('a beginner with only the essentials', () {
    testWidgets('sees an estimated max HR and rough zones', (tester) async {
      await pumpApp(tester);
      await openNumbers(tester);

      // Born 2004, "now" is 2026 -> 22 -> 208 - 15.4 = 193.
      expect(bigNumber('193 bpm'), findsOneWidget);
      expect(find.text('Zone 1'), findsOneWidget);
      expect(find.text('97 to 115 bpm'), findsOneWidget);
      expect(find.text('174 to 193 bpm'), findsOneWidget);

      final chips = tester
          .widgetList<ConfidenceChip>(find.byType(ConfidenceChip))
          .map((chip) => chip.confidence)
          .toList();
      expect(chips.take(2), [Confidence.estimated, Confidence.rough]);
    });

    testWidgets('is told what to add instead of seeing blanks', (tester) async {
      await pumpApp(tester);
      await openNumbers(tester);

      await reveal(
        tester,
        find.text('Know your FTP? Add it to see your power zones.'),
      );
      await reveal(
        tester,
        find.text('Add your inseam to get a saddle-height starting point.'),
      );
      await reveal(
        tester,
        find.text(
          'To calculate your climbing gears, tell me your tyre size, '
          'chainrings and cassette.',
        ),
      );
    });

    testWidgets('"Why?" explains the max HR: formula, input, source', (
      tester,
    ) async {
      await pumpApp(tester);
      await openNumbers(tester);

      await tester.tap(find.text('Why?').first);
      await tester.pumpAndSettle();

      expect(find.text('Age-based estimate'), findsOneWidget);
      expect(
        find.text('Maximum heart rate is about 208 minus 0.7 times your age.'),
        findsOneWidget,
      );
      expect(find.text('Age: 22 years'), findsOneWidget);
      expect(
        find.text('From a published formula, using what you told us.'),
        findsOneWidget,
      );
      // The status line sits just under the citation, at the very bottom.
      await tester.scrollUntilVisible(
        find.text('Source checked'),
        200,
        scrollable: find.byType(Scrollable).last,
      );
      expect(
        find.textContaining('Tanaka H, Monahan KD, Seals DR'),
        findsOneWidget,
      );
    });

    testWidgets('"Why?" for the zones says how to improve them', (
      tester,
    ) async {
      await pumpApp(tester);
      await openNumbers(tester);

      await tester.tap(find.text('Why?').at(1));
      await tester.pumpAndSettle();

      expect(find.text('Zones from maximum heart rate'), findsWidgets);
      await tester.scrollUntilVisible(
        find.textContaining('Do a threshold test'),
        200,
        scrollable: find.byType(Scrollable).last,
      );
      expect(
        find.textContaining('Add your resting heart rate'),
        findsOneWidget,
      );
    });
  });

  testWidgets('a rider with FTP, LTHR and inseam sees measured numbers', (
    tester,
  ) async {
    await pumpApp(
      tester,
      rider: testRider.copyWith(ftpWatts: 180, lthrBpm: 170, inseamMm: 760),
      bike: testBike,
    );
    await openNumbers(tester);

    // Friel zones from LTHR 170: zone 5a starts at threshold.
    expect(find.text('Zones from your threshold heart rate'), findsOneWidget);
    expect(find.text('Zone 5a'), findsOneWidget);
    expect(find.text('170 to 174 bpm'), findsOneWidget);

    // 180 W / 58.5 kg = 3.08 W/kg.
    await reveal(tester, bigNumber('3.08 W/kg'));
    // 55% of 180 = 99 -> level 1 is "up to 99".
    await reveal(tester, find.text('up to 99 W'));

    // 0.883 x 760 mm = 671 mm = 67.1 cm; current saddle 762 mm is 9.1 cm up.
    await reveal(tester, bigNumber('67.1 cm'));
    expect(
      find.text('Your saddle is 9.1 cm higher than this starting point.'),
      findsOneWidget,
    );
  });

  group('gears and climbs on the reference road bike', () {
    testWidgets('shows wheel size and a cadence for every gear', (
      tester,
    ) async {
      await pumpApp(tester, bike: testBike);
      await openNumbers(tester);

      // pi x (622 + 2 x 25) = 2111 mm.
      await reveal(tester, bigNumber('2111 mm'));
      // Easiest gear at the default 10 km/h: 10000/60 / 2.1112 = 79 rpm.
      await reveal(tester, find.text('34 × 34'));
      expect(find.text('79 rpm'), findsWidgets);
    });

    testWidgets('changing the speed recalculates the cadences', (tester) async {
      await pumpApp(tester, bike: testBike);
      await openNumbers(tester);

      await tapTimes(tester, 'Decrease Speed', 2);

      // 8 km/h in 34x34 -> 63 rpm.
      await reveal(tester, find.text('34 × 34'));
      expect(find.text('63 rpm'), findsWidgets);
    });

    testWidgets('says the cogs are estimated until confirmed', (tester) async {
      await pumpApp(tester, bike: testBike);
      await openNumbers(tester);

      await reveal(
        tester,
        find.textContaining('Your middle cogs are estimated'),
      );
    });

    testWidgets('a gentle climb recommends a gear in the comfortable band', (
      tester,
    ) async {
      await pumpApp(tester, bike: testBike);
      await openNumbers(tester);

      await reveal(tester, find.textContaining('Best gear:'));
      expect(find.textContaining('You will be grinding'), findsNothing);
    });

    testWidgets('a steep climb warns about grinding and proposes gearing', (
      tester,
    ) async {
      await pumpApp(tester, bike: testBike);
      await openNumbers(tester);

      // 5% -> 15%.
      await tapTimes(tester, 'Increase Gradient', 10);

      await reveal(tester, find.textContaining('You will be grinding'));
      expect(find.textContaining('would let you spin'), findsOneWidget);
      expect(find.textContaining('Best gear: 34 × 34'), findsOneWidget);
    });

    testWidgets('going easier makes the climb slower', (tester) async {
      await pumpApp(tester, bike: testBike);
      await openNumbers(tester);
      await reveal(tester, find.text('Expected speed'));

      // The speed is a rich text like "9.4 km/h".
      double shownSpeed() {
        final speeds = tester
            .widgetList<RichText>(find.byType(RichText))
            .map((rich) => rich.text.toPlainText())
            .where((text) => text.endsWith(' km/h'));
        return double.parse(speeds.single.split(' ').first);
      }

      final steady = shownSpeed();
      await tapText(tester, 'Easy');
      await reveal(tester, find.text('Expected speed'));

      expect(shownSpeed(), lessThan(steady));
    });
  });

  group('heat check', () {
    testWidgets('32 C at 70% is Extreme caution', (tester) async {
      await pumpApp(tester);
      await openNumbers(tester);

      await reveal(tester, find.byType(HeatBadge));

      expect(
        tester.widget<HeatBadge>(find.byType(HeatBadge)).risk,
        HeatRisk.extremeCaution,
      );
      expect(find.text('Extreme caution'), findsOneWidget);
    });

    testWidgets('hotter and more humid becomes Danger with ride advice', (
      tester,
    ) async {
      await pumpApp(tester);
      await openNumbers(tester);

      // 32 C / 70% -> 34 C / 80%.
      await tapTimes(tester, 'Increase Air temperature', 2);
      await tapTimes(tester, 'Increase Humidity', 2);
      await reveal(tester, find.byType(HeatBadge));

      expect(
        tester.widget<HeatBadge>(find.byType(HeatBadge)).risk,
        HeatRisk.extremeDanger,
      );
      expect(find.text('Do not ride outdoors in this heat.'), findsOneWidget);
    });

    testWidgets('a cool, dry day is Not hazardous', (tester) async {
      await pumpApp(tester);
      await openNumbers(tester);

      // 32 C / 70% -> 22 C / 40%.
      await tapTimes(tester, 'Decrease Air temperature', 10);
      await tapTimes(tester, 'Decrease Humidity', 6);
      await reveal(tester, find.byType(HeatBadge));

      expect(
        tester.widget<HeatBadge>(find.byType(HeatBadge)).risk,
        HeatRisk.notHazardous,
      );
    });
  });

  testWidgets('imperial units show speed in mph and heat in F', (tester) async {
    await pumpApp(
      tester,
      bike: testBike,
      rider: testRider.copyWith(sex: Sex.preferNotToSay),
      prepare: (database) => database.customStatement(
        'INSERT INTO app_settings (id, created_at, updated_at, theme_mode, '
        "unit_system) VALUES ('app', '2026-11-23T08:00:00.000Z', "
        "'2026-11-23T08:00:00.000Z', 'system', 'imperial')",
      ),
    );
    await openNumbers(tester);

    await reveal(tester, find.text('Speed'));
    // 10 km/h is 6.2 mph.
    expect(find.text('6.2 mph'), findsOneWidget);
    await reveal(tester, find.text('Air temperature'));
    // 32 C is 90 F.
    expect(find.text('90 °F'), findsOneWidget);
  });
}
