import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/app/app.dart';
import 'package:ride_doctor/core/app/environment.dart';
import 'package:ride_doctor/core/database/app_database.dart';
import 'package:ride_doctor/core/database/database_providers.dart';
import 'package:ride_doctor/features/onboarding/data/drift_onboarding_repositories.dart';
import 'package:ride_doctor/features/onboarding/domain/consent.dart';
import 'package:ride_doctor/features/onboarding/domain/readiness.dart';
import 'package:ride_doctor/features/profile/data/drift_garage_repository.dart';
import 'package:ride_doctor/features/profile/data/drift_rider_repository.dart';
import 'package:ride_doctor/features/profile/domain/bike.dart';
import 'package:ride_doctor/features/profile/domain/rider_profile.dart';
import 'package:ride_doctor/features/race_prep/data/drift_race_repository.dart';
import 'package:ride_doctor/features/race_prep/domain/race_event.dart';

import 'test_database.dart';

/// "Now" in every widget test: fixed, so ages and dates never drift.
// Local time, like the real clock: race starts are wall-clock times.
final testNow = DateTime(2026, 11, 23, 8);

/// A rider straight out of onboarding: essentials only.
const testRider = RiderProfile(
  displayName: 'France',
  birthYear: 2004,
  heightCm: 165,
  weightKg: 58.5,
  yearsRiding: 1.5,
  ridesPerWeek: 4,
  typicalRideMinutes: 90,
  hoursPerWeek: 8,
  goal: RidingGoal.raceFaster,
);

/// The owner's road bike, cogs estimated from an 11-34 10-speed cassette.
const testBike = Bike(
  id: 'bike-1',
  type: BikeType.road,
  beadSeatDiameterMm: 622,
  tyreWidthMm: 25,
  crankLengthMm: 160,
  pedals: PedalType.flat,
  saddleHeightMm: 762,
  drivetrain: Drivetrain(
    chainrings: [34, 50],
    cogs: [11, 12, 14, 16, 18, 21, 23, 26, 30, 34],
    cogsConfirmed: false,
  ),
);

/// Puts a finished onboarding into [database], as the real flow would.
Future<void> seedOnboardedRider(
  AppDatabase database, {
  RiderProfile rider = testRider,
  Bike bike = const Bike(id: 'bike-1', type: BikeType.road),
  bool readinessYes = false,
}) async {
  DateTime clock() => testNow;
  final ids = sequentialIds();
  final consents = DriftConsentRepository(database, clock: clock, newId: ids);
  await consents.record(ConsentKind.healthData, granted: true);
  await consents.record(ConsentKind.location, granted: false);
  await consents.record(ConsentKind.notifications, granted: false);
  await DriftRiderRepository(
    database,
    clock: clock,
    newId: ids,
  ).saveProfile(rider);
  await DriftReadinessRepository(database, newId: ids).save(
    ReadinessScreening(
      answers: {
        for (final question in ReadinessQuestion.values)
          question: readinessYes && question == ReadinessQuestion.chestPain,
      },
      questionnaireVersion: readinessQuestionnaireVersion,
      completedAt: testNow,
    ),
  );
  await DriftGarageRepository(
    database,
    clock: clock,
    newId: ids,
  ).saveBike(bike);
}

/// Starts the whole app, exactly as `main()` does, on an in-memory database.
///
/// By default the rider is already onboarded; pass `onboarded: false` for a
/// first launch. [size] is in logical pixels. [textScale] simulates the
/// system font-size accessibility setting (2.0 = 200%). Returns the database
/// so a test can check what was really stored.
Future<AppDatabase> pumpApp(
  WidgetTester tester, {
  Size size = const Size(412, 915),
  double textScale = 1,
  List<Locale>? deviceLocales,
  bool onboarded = true,
  RiderProfile rider = testRider,
  Bike bike = const Bike(id: 'bike-1', type: BikeType.road),
  bool readinessYes = false,
  List<Override> overrides = const [],
  Future<void> Function(AppDatabase database)? prepare,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  if (deviceLocales != null) {
    tester.platformDispatcher.localesTestValue = deviceLocales;
  }
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearAllTestValues);

  final database = newTestDatabase();
  // Order matters: take the app down before closing the database it is
  // listening to. When a test FAILS the framework leaves the app mounted, and
  // closing the database underneath it never completes - the run then hangs
  // until CI times out instead of reporting the failure.
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox());
    await database.close();
  });
  if (onboarded) {
    await seedOnboardedRider(
      database,
      rider: rider,
      bike: bike,
      readinessYes: readinessYes,
    );
  }
  // Anything else a test wants in the database before the app starts.
  await prepare?.call(database);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        appDatabaseProvider.overrideWith((ref) async => database),
        clockProvider.overrideWithValue(() => testNow),
        ...overrides,
      ],
      child: const RideDoctorApp(),
    ),
  );
  await tester.pumpAndSettle();
  return database;
}

/// Types into the text field with this label.
Future<void> enterField(WidgetTester tester, String label, String text) async {
  final field = find.widgetWithText(TextFormField, label);
  await tester.ensureVisible(field);
  await tester.pumpAndSettle();
  await tester.enterText(field, text);
  await tester.pumpAndSettle();
}

/// Lets any "Saved" message finish and disappear. It sits over the bottom of
/// the screen for four seconds and swallows taps on whatever is under it.
Future<void> _clearSnackBars(WidgetTester tester) async {
  if (find.byType(SnackBar).evaluate().isEmpty) return;
  await tester.pump(const Duration(seconds: 5));
  await tester.pumpAndSettle();
}

/// Scrolls to a widget showing [text] and taps it.
Future<void> tapText(WidgetTester tester, String text) async {
  await _clearSnackBars(tester);
  final target = find.text(text);
  await tester.ensureVisible(target.first);
  await tester.pumpAndSettle();
  await tester.tap(target.first);
  await tester.pumpAndSettle();
}

/// Scrolls to the button labelled [label] and presses it. Use this rather
/// than [tapText] when a heading on the same screen has the same words.
Future<void> tapButton(WidgetTester tester, String label) async {
  await _clearSnackBars(tester);
  final button = find.ancestor(
    of: find.text(label),
    matching: find.bySubtype<ButtonStyleButton>(),
  );
  await tester.ensureVisible(button);
  await tester.pumpAndSettle();
  await tester.tap(button);
  await tester.pumpAndSettle();
}

/// A criterium starting [startsIn] after [testNow] (negative: in the past).
RaceEvent testRace({
  String id = 'race-1',
  String name = 'Cavite Crit',
  RaceType type = RaceType.criterium,
  Duration startsIn = const Duration(days: 5),
  bool reconAllowed = true,
}) => RaceEvent(
  id: id,
  name: name,
  type: type,
  startsAt: testNow.add(startsIn),
  reconAllowed: reconAllowed,
);

/// Stores [races] before the app starts; pass to pumpApp's `prepare`.
Future<void> Function(AppDatabase) seedRaces(List<RaceEvent> races) =>
    (database) async {
      final repository = DriftRaceRepository(
        database,
        clock: () => testNow,
        newId: sequentialIds(),
      );
      for (final race in races) {
        await repository.saveRace(race);
      }
    };
