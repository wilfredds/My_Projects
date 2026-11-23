import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/features/profile/presentation/edit_bike_screen.dart';
import 'package:ride_doctor/features/profile/presentation/edit_rider_screen.dart';
import 'package:ride_doctor/features/profile/presentation/profile_screen.dart';

import '../../helpers/pump_app.dart';

Future<void> openProfile(WidgetTester tester) async {
  await tester.tap(find.text('Profile'));
  await tester.pumpAndSettle();
}

void main() {
  group('profile', () {
    testWidgets('shows what is known and marks the rest as not set', (
      tester,
    ) async {
      await pumpApp(tester);
      await openProfile(tester);

      expect(find.text('France'), findsOneWidget);
      expect(find.text('58.5 kg'), findsOneWidget);
      expect(find.text('165 cm'), findsOneWidget);
      expect(find.text('Race faster'), findsOneWidget);
      expect(find.text('Not set'), findsWidgets);
    });

    testWidgets('ticking a sensor stores it; unticking removes it', (
      tester,
    ) async {
      final database = await pumpApp(tester);
      await openProfile(tester);

      await tapText(tester, 'Heart-rate strap');
      await tapText(tester, 'Power meter');
      var kinds = (await database.select(database.sensors).get()).map(
        (row) => row.kind,
      );
      expect(kinds, unorderedEquals(['hrStrap', 'powerMeter']));

      await tapText(tester, 'Heart-rate strap');
      kinds = (await database.select(database.sensors).get()).map(
        (row) => row.kind,
      );
      expect(kinds, ['powerMeter']);
    });
  });

  group('editing the rider', () {
    testWidgets('opens pre-filled with the stored values', (tester) async {
      await pumpApp(tester);
      await openProfile(tester);
      await tapText(tester, 'Edit your details');

      expect(find.byType(EditRiderScreen), findsOneWidget);
      expect(find.widgetWithText(TextFormField, 'France'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, '2004'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, '58.5'), findsOneWidget);
    });

    testWidgets('adding FTP, inseam and resting HR saves and unlocks numbers', (
      tester,
    ) async {
      final database = await pumpApp(tester);
      await openProfile(tester);
      await tapText(tester, 'Edit your details');

      await enterField(tester, 'Inseam (Optional)', '76');
      await enterField(tester, 'Resting heart rate (Optional)', '52');
      await enterField(tester, 'FTP (Optional)', '180');
      await tapText(tester, 'Save');

      expect(find.byType(ProfileScreen), findsOneWidget);
      final rider = await database.select(database.riderProfiles).getSingle();
      expect(rider.inseamMm, 760);
      expect(rider.restingHrBpm, 52);
      expect(rider.ftpWatts, 180);
      // The essentials were not disturbed.
      expect(rider.displayName, 'France');
      expect(rider.weightKg, 58.5);

      await tester.tap(find.text('My Numbers'));
      await tester.pumpAndSettle();
      expect(find.text('Zones from heart-rate reserve'), findsOneWidget);
    });

    testWidgets('an out-of-range optional value blocks saving', (tester) async {
      final database = await pumpApp(tester);
      await openProfile(tester);
      await tapText(tester, 'Edit your details');

      await enterField(tester, 'Resting heart rate (Optional)', '300');
      await tapText(tester, 'Save');

      expect(find.byType(EditRiderScreen), findsOneWidget);
      expect(
        find.text('That looks too high. Enter 120 bpm or less.'),
        findsOneWidget,
      );
      final rider = await database.select(database.riderProfiles).getSingle();
      expect(rider.restingHrBpm, isNull);
    });

    testWidgets('clearing an optional value removes it', (tester) async {
      final database = await pumpApp(
        tester,
        rider: testRider.copyWith(ftpWatts: 200),
      );
      await openProfile(tester);
      await tapText(tester, 'Edit your details');

      await enterField(tester, 'FTP (Optional)', '');
      await tapText(tester, 'Save');

      final rider = await database.select(database.riderProfiles).getSingle();
      expect(rider.ftpWatts, isNull);
    });

    testWidgets('a fractional heart rate is rejected as not whole', (
      tester,
    ) async {
      await pumpApp(tester);
      await openProfile(tester);
      await tapText(tester, 'Edit your details');

      await enterField(tester, 'Resting heart rate (Optional)', '52.5');
      await tapText(tester, 'Save');

      expect(find.text('Please enter a whole number.'), findsOneWidget);
    });
  });

  group('editing the bike', () {
    Future<void> openBikeEditor(WidgetTester tester) async {
      await openProfile(tester);
      await tapText(tester, 'Edit bike details');
      expect(find.byType(EditBikeScreen), findsOneWidget);
    }

    testWidgets('tyre, chainrings and a cassette range unlock the gear '
        'calculations', (tester) async {
      final database = await pumpApp(tester);
      await openBikeEditor(tester);

      await tapText(tester, '700 x 25C');
      await enterField(tester, 'Chainrings (Optional)', '50/34');
      await enterField(tester, 'Smallest cog (Optional)', '11');
      await enterField(tester, 'Largest cog (Optional)', '34');
      await enterField(tester, 'Number of cogs (Optional)', '10');
      await tapText(tester, 'Fill in cogs from this range');
      await tapText(tester, 'Save');

      expect(find.byType(ProfileScreen), findsOneWidget);
      final bike = await database.select(database.bikes).getSingle();
      expect(bike.beadSeatDiameterMm, 622);
      expect(bike.tyreWidthMm, 25);
      final drivetrain = await database
          .select(database.drivetrains)
          .getSingle();
      expect(drivetrain.chainrings, '34,50');
      final cogs = drivetrain.cogs.split(',').map(int.parse).toList();
      expect(cogs, hasLength(10));
      expect(cogs.first, 11);
      expect(cogs.last, 34);
      // Estimated from the range, so not confirmed.
      expect(drivetrain.cogsConfirmed, isFalse);

      await tester.tap(find.text('My Numbers'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('2111 mm', findRichText: true),
        300,
        scrollable: find.byType(Scrollable).first,
      );
    });

    testWidgets('typing exact cogs and confirming them is stored as '
        'confirmed', (tester) async {
      final database = await pumpApp(tester);
      await openBikeEditor(tester);

      await enterField(tester, 'Chainrings (Optional)', '34, 50');
      await enterField(
        tester,
        'All cogs (Optional)',
        '11-13-15-17-19-21-24-27-30-34',
      );
      await tapText(tester, 'I have checked these cogs');
      await tapText(tester, 'Save');

      final drivetrain = await database
          .select(database.drivetrains)
          .getSingle();
      expect(drivetrain.cogs, '11,13,15,17,19,21,24,27,30,34');
      expect(drivetrain.cogsConfirmed, isTrue);
    });

    testWidgets('an impossible cassette range is refused', (tester) async {
      await pumpApp(tester);
      await openBikeEditor(tester);

      await enterField(tester, 'Smallest cog (Optional)', '11');
      await enterField(tester, 'Largest cog (Optional)', '13');
      await enterField(tester, 'Number of cogs (Optional)', '10');
      await tapText(tester, 'Fill in cogs from this range');

      expect(
        find.text('That range and number of cogs do not fit together.'),
        findsOneWidget,
      );
    });

    testWidgets('chainrings without cogs asks for the cogs too', (
      tester,
    ) async {
      final database = await pumpApp(tester);
      await openBikeEditor(tester);

      await enterField(tester, 'Chainrings (Optional)', '34, 50');
      await tapText(tester, 'Save');

      expect(find.byType(EditBikeScreen), findsOneWidget);
      expect(find.text('Please fill this in.'), findsOneWidget);
      expect(await database.select(database.drivetrains).get(), isEmpty);
    });

    testWidgets('nonsense tooth counts are refused with the allowed range', (
      tester,
    ) async {
      await pumpApp(tester);
      await openBikeEditor(tester);

      await enterField(tester, 'Chainrings (Optional)', '34, 99');
      await enterField(tester, 'All cogs (Optional)', '11, 34');
      await tapText(tester, 'Save');

      expect(find.textContaining('from 20 to 60'), findsOneWidget);
    });

    testWidgets('a custom tyre size, saddle height and pressure are stored '
        'in metric', (tester) async {
      final database = await pumpApp(tester);
      await openBikeEditor(tester);

      await tapText(tester, 'Other size');
      await enterField(tester, 'Rim diameter (ETRTO)', '622');
      await enterField(tester, 'Tyre width', '30');
      await enterField(tester, 'Crank length (Optional)', '160');
      await tapText(tester, 'Flat');
      await enterField(tester, 'Saddle height (Optional)', '76.2');
      await enterField(tester, 'Tyre pressure (Optional)', '90');
      await tapText(tester, 'Save');

      final bike = await database.select(database.bikes).getSingle();
      expect(bike.tyreWidthMm, 30);
      expect(bike.crankLengthMm, 160);
      expect(bike.pedals, 'flat');
      expect(bike.saddleHeightMm, closeTo(762, 1e-6));
      // 90 psi = 620.5 kPa.
      expect(bike.tyrePressureKpa, closeTo(620.5, 0.1));
    });

    testWidgets('reopens with everything that was saved', (tester) async {
      await pumpApp(tester, bike: testBike);
      await openBikeEditor(tester);

      expect(find.widgetWithText(TextFormField, '34, 50'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, '160'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, '76.2'), findsOneWidget);
      final preset = tester.widget<ChoiceChip>(
        find.widgetWithText(ChoiceChip, '700 x 25C'),
      );
      expect(preset.selected, isTrue);
    });

    testWidgets('saving keeps the same bike row', (tester) async {
      final database = await pumpApp(tester, bike: testBike);
      await openBikeEditor(tester);

      await tapText(tester, '700 x 28C');
      await tapText(tester, 'Save');

      final bike = await database.select(database.bikes).getSingle();
      expect(bike.id, 'bike-1');
      expect(bike.tyreWidthMm, 28);
      // Untouched fields survive the round trip through the form.
      expect(bike.saddleHeightMm, closeTo(762, 1e-6));
      expect(bike.crankLengthMm, 160);
    });
  });
}
