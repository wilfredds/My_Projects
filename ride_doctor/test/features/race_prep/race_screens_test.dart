import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/features/race_prep/domain/race_event.dart';
import 'package:ride_doctor/features/race_prep/presentation/debrief_screen.dart';
import 'package:ride_doctor/features/race_prep/presentation/race_detail_screen.dart';
import 'package:ride_doctor/features/race_prep/presentation/race_form_screen.dart';
import 'package:ride_doctor/features/race_prep/presentation/races_screen.dart';

import '../../helpers/pump_app.dart';

Future<void> openRaces(WidgetTester tester) async {
  await tester.tap(find.byIcon(Icons.flag_outlined));
  await tester.pumpAndSettle();
  expect(find.byType(RacesScreen), findsOneWidget);
}

Future<void> openRace(WidgetTester tester, String name) async {
  await openRaces(tester);
  await tapText(tester, name);
  expect(find.byType(RaceDetailScreen), findsOneWidget);
}

/// The detail screen's timeline as "HH:MM label" lines.
bool timelineHas(String time, String label) {
  final row = find.ancestor(of: find.text(label), matching: find.byType(Row));
  return find
      .descendant(of: row, matching: find.text(time))
      .evaluate()
      .isNotEmpty;
}

void main() {
  group('adding a race (the spec integration path: add race -> countdown '
      'mode -> race-day timeline)', () {
    testWidgets('a new race appears with its countdown, mode and timeline', (
      tester,
    ) async {
      final database = await pumpApp(tester);
      await openRaces(tester);
      expect(find.text('No races yet'), findsOneWidget);

      await tapText(tester, 'Add a race');
      expect(find.byType(RaceFormScreen), findsOneWidget);
      await enterField(tester, 'Race name', 'Cavite Crit');
      await tapText(tester, 'Criterium');
      // "Now" is 23 Nov 2026; pick the 28th in the calendar that opens.
      await tapText(tester, 'Choose date');
      await tester.tap(find.text('28'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('OK'));
      await tester.pumpAndSettle();
      await enterField(tester, 'Start time', '06:30');
      await tapButton(tester, 'Save');

      // Back on the list: five days out is race week.
      expect(find.byType(RacesScreen), findsOneWidget);
      expect(find.text('Cavite Crit'), findsOneWidget);
      expect(find.textContaining('In 5 days · Race week'), findsOneWidget);
      final row = await database.select(database.raceEvents).getSingle();
      expect(row.startsAtLocal, '2026-11-28T06:30:00.000');
      expect(row.raceType, 'criterium');

      await tapText(tester, 'Cavite Crit');
      expect(find.text('In 5 days'), findsOneWidget);
      expect(find.text('Race week'), findsOneWidget);
      // Timeline worked backward from 06:30 with the default 30 min drive.
      expect(timelineHas('06:30', 'Race start'), isTrue);
      expect(timelineHas('03:30', 'Wake up'), isTrue);
      expect(timelineHas('04:00', 'Eat your pre-race meal'), isTrue);
      expect(timelineHas('05:15', 'Arrive at the venue'), isTrue);
      expect(timelineHas('06:00', 'Start your warm-up'), isTrue);
      expect(find.text('0 of 20 ready'), findsOneWidget);
    });

    testWidgets('saving an empty form says what is missing', (tester) async {
      final database = await pumpApp(tester);
      await openRaces(tester);
      await tapText(tester, 'Add a race');

      await tapButton(tester, 'Save');

      expect(find.byType(RaceFormScreen), findsOneWidget);
      // Name, type and start time.
      expect(find.text('Please fill this in.'), findsNWidgets(3));
      expect(find.text('Choose a date.'), findsOneWidget);
      expect(await database.select(database.raceEvents).get(), isEmpty);
    });

    testWidgets('an impossible start time is refused', (tester) async {
      await pumpApp(tester);
      await openRaces(tester);
      await tapText(tester, 'Add a race');

      await enterField(tester, 'Start time', '25:00');
      await tapButton(tester, 'Save');

      expect(find.text('Enter a time like 06:30.'), findsOneWidget);
    });
  });

  group('the countdown mode picks itself', () {
    testWidgets('each race shows the mode for its distance', (tester) async {
      await pumpApp(
        tester,
        prepare: seedRaces([
          testRace(
            id: 'a',
            name: 'Far Off GP',
            startsIn: const Duration(days: 60),
          ),
          testRace(
            id: 'b',
            name: 'Next Month RR',
            startsIn: const Duration(days: 30),
          ),
          testRace(id: 'c', name: 'This Week Crit'),
          testRace(
            id: 'd',
            name: 'Tomorrow TT',
            startsIn: const Duration(hours: 22),
          ),
        ]),
      );
      await openRaces(tester);

      expect(
        find.textContaining('In 60 days · Building toward race day'),
        findsOneWidget,
      );
      expect(find.textContaining('In 30 days · Short build'), findsOneWidget);
      expect(find.textContaining('In 5 days · Race week'), findsOneWidget);
      expect(find.textContaining('Tomorrow · Race day'), findsOneWidget);
    });

    testWidgets('a long build shows base, build and a sourced taper', (
      tester,
    ) async {
      await pumpApp(
        tester,
        prepare: seedRaces([testRace(startsIn: const Duration(days: 84))]),
      );
      await openRace(tester, 'Cavite Crit');

      expect(find.text('Building toward race day'), findsOneWidget);
      expect(find.text('Base'), findsOneWidget);
      expect(find.text('Build'), findsOneWidget);
      expect(find.text('Taper'), findsOneWidget);
      expect(find.textContaining('Bosquet et al., 2007'), findsOneWidget);
    });

    testWidgets('race week has no training phases', (tester) async {
      await pumpApp(tester, prepare: seedRaces([testRace()]));
      await openRace(tester, 'Cavite Crit');

      expect(find.text('Taper'), findsNothing);
    });
  });

  group('race detail', () {
    testWidgets('ticking the checklist is stored and counted', (tester) async {
      final database = await pumpApp(tester, prepare: seedRaces([testRace()]));
      await openRace(tester, 'Cavite Crit');

      await tapText(tester, 'Helmet');
      await tapText(tester, 'Spare tube');
      expect(find.text('2 of 20 ready'), findsOneWidget);
      final ticked = (await database.select(database.raceChecklistItems).get())
          .where((row) => row.checked)
          .map((row) => row.item);
      expect(ticked, unorderedEquals(['helmet', 'spareTube']));

      await tapText(tester, 'Helmet');
      expect(find.text('1 of 20 ready'), findsOneWidget);

      await tapButton(tester, 'Untick all');
      expect(find.text('0 of 20 ready'), findsOneWidget);
    });

    testWidgets('a criterium shows its skills, each with a drill', (
      tester,
    ) async {
      await pumpApp(tester, prepare: seedRaces([testRace()]));
      await openRace(tester, 'Cavite Crit');

      expect(find.text('Hold your line'), findsOneWidget);
      expect(find.text('Primes'), findsOneWidget);
      expect(find.text('Try this drill'), findsNothing);

      await tapText(tester, 'Shift before the corner');

      expect(find.text('Try this drill'), findsOneWidget);
      expect(
        find.textContaining('shift one or two gears easier'),
        findsOneWidget,
      );
    });

    testWidgets('a time trial shows pacing, not criterium tactics', (
      tester,
    ) async {
      await pumpApp(
        tester,
        prepare: seedRaces([testRace(type: RaceType.timeTrial)]),
      );
      await openRace(tester, 'Cavite Crit');

      expect(find.text('Pace it evenly'), findsOneWidget);
      expect(find.text('Primes'), findsNothing);
    });

    testWidgets('no course preview, no recon step in the timeline', (
      tester,
    ) async {
      await pumpApp(
        tester,
        prepare: seedRaces([testRace(reconAllowed: false)]),
      );
      await openRace(tester, 'Cavite Crit');

      expect(find.text('Ride the course'), findsNothing);
      expect(find.text('Race start'), findsOneWidget);
    });

    testWidgets('editing changes the race in place', (tester) async {
      final database = await pumpApp(tester, prepare: seedRaces([testRace()]));
      await openRace(tester, 'Cavite Crit');

      await tester.tap(find.byIcon(Icons.edit_outlined));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(TextFormField, 'Cavite Crit'), findsOneWidget);
      await enterField(tester, 'Race name', 'Cavite Night Crit');
      await enterField(tester, 'Start time', '19:00');
      await tapButton(tester, 'Save');

      expect(find.text('Cavite Night Crit'), findsOneWidget);
      expect(timelineHas('19:00', 'Race start'), isTrue);
      final row = await database.select(database.raceEvents).getSingle();
      expect(row.id, 'race-1');
      expect(row.startsAtLocal, '2026-11-28T19:00:00.000');
    });

    testWidgets('deleting asks first, then removes the race', (tester) async {
      final database = await pumpApp(tester, prepare: seedRaces([testRace()]));
      await openRace(tester, 'Cavite Crit');

      await tester.tap(find.byIcon(Icons.delete_outline));
      await tester.pumpAndSettle();
      expect(find.text('Delete this race?'), findsOneWidget);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(await database.select(database.raceEvents).get(), hasLength(1));

      await tester.tap(find.byIcon(Icons.delete_outline));
      await tester.pumpAndSettle();
      await tapButton(tester, 'Delete race');

      expect(find.byType(RacesScreen), findsOneWidget);
      expect(find.text('No races yet'), findsOneWidget);
      expect(await database.select(database.raceEvents).get(), isEmpty);
    });
  });

  group('debrief', () {
    final pastRace = testRace(
      name: 'First Crit',
      startsIn: const Duration(days: -3),
    );

    testWidgets('a past race asks for a debrief, and the result joins the '
        'history', (tester) async {
      final database = await pumpApp(tester, prepare: seedRaces([pastRace]));
      await openRaces(tester);
      expect(find.text('Past races'), findsOneWidget);
      expect(find.textContaining('No debrief yet'), findsOneWidget);

      await tapText(tester, 'First Crit');
      expect(find.text('Race done'), findsOneWidget);
      await tapButton(tester, 'Add your debrief');
      expect(find.byType(DebriefScreen), findsOneWidget);

      await tapText(tester, 'Yes');
      await enterField(tester, 'Your place (Optional)', '10');
      await enterField(tester, 'Riders in your race (Optional)', '10');
      await tapText(tester, 'Mid-race');
      await tapText(tester, 'Climbs');
      await tapText(tester, 'Sudden accelerations');
      await tapText(tester, 'Cramps');
      await enterField(tester, 'Optional', 'Easier gears');
      await tapButton(tester, 'Save');

      expect(find.byType(RaceDetailScreen), findsOneWidget);
      expect(find.text('Place 10 of 10'), findsOneWidget);
      expect(find.text('Climbs, Sudden accelerations'), findsOneWidget);
      expect(find.text('Easier gears'), findsOneWidget);
      expect(find.text('Please see a doctor'), findsNothing);

      final row = await database.select(database.raceDebriefs).getSingle();
      expect(row.finished, isTrue);
      expect(row.placing, 10);
      expect(row.fieldSize, 10);
      expect(row.droppedWhen, 'midRace');
      expect(row.struggles, 'climbs,accelerations');
      expect(row.symptoms, 'cramps');

      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.textContaining('Place 10 of 10'), findsOneWidget);
    });

    testWidgets('the two required answers are enforced', (tester) async {
      final database = await pumpApp(tester, prepare: seedRaces([pastRace]));
      await openRace(tester, 'First Crit');
      await tapButton(tester, 'Add your debrief');

      await tapButton(tester, 'Save');

      expect(find.byType(DebriefScreen), findsOneWidget);
      expect(find.text('Please fill this in.'), findsNWidgets(2));
      expect(await database.select(database.raceDebriefs).get(), isEmpty);
    });

    testWidgets('a place beyond the field size is refused', (tester) async {
      await pumpApp(tester, prepare: seedRaces([pastRace]));
      await openRace(tester, 'First Crit');
      await tapButton(tester, 'Add your debrief');

      await tapText(tester, 'Yes');
      await tapText(tester, 'Mid-race');
      await enterField(tester, 'Your place (Optional)', '12');
      await enterField(tester, 'Riders in your race (Optional)', '10');
      await tapButton(tester, 'Save');

      expect(
        find.text('Your place cannot be higher than the number of riders.'),
        findsOneWidget,
      );
    });

    testWidgets('dizziness always leads to "see a doctor"', (tester) async {
      await pumpApp(tester, prepare: seedRaces([pastRace]));
      await openRace(tester, 'First Crit');
      await tapButton(tester, 'Add your debrief');

      await tapText(tester, 'No');
      await tapText(tester, 'Early on');
      await tapText(tester, 'Dizziness');
      await tapButton(tester, 'Save');

      expect(find.text('Please see a doctor'), findsOneWidget);
      expect(find.text('Did not finish'), findsOneWidget);
    });

    testWidgets('a saved debrief can be reopened and changed', (tester) async {
      final database = await pumpApp(tester, prepare: seedRaces([pastRace]));
      await openRace(tester, 'First Crit');
      await tapButton(tester, 'Add your debrief');
      await tapText(tester, 'Yes');
      await tapText(tester, 'Mid-race');
      await tapButton(tester, 'Save');

      await tapButton(tester, 'Edit debrief');
      await tapText(tester, 'Near the end');
      await tapButton(tester, 'Save');

      final row = await database.select(database.raceDebriefs).getSingle();
      expect(row.droppedWhen, 'nearTheEnd');
      expect(row.finished, isTrue);
    });
  });

  group('Today', () {
    testWidgets('shows the next race and opens its plan', (tester) async {
      await pumpApp(
        tester,
        prepare: seedRaces([
          testRace(
            id: 'later',
            name: 'Later GP',
            startsIn: const Duration(days: 40),
          ),
          testRace(),
        ]),
      );

      expect(find.text('Cavite Crit'), findsOneWidget);
      expect(find.text('In 5 days'), findsOneWidget);
      expect(find.text('Race week'), findsOneWidget);
      expect(find.text('Later GP'), findsNothing);

      await tapButton(tester, 'Open race plan');
      expect(find.byType(RaceDetailScreen), findsOneWidget);
    });

    testWidgets('nudges for a debrief after a race, until it is done', (
      tester,
    ) async {
      await pumpApp(
        tester,
        prepare: seedRaces([
          testRace(name: 'First Crit', startsIn: const Duration(days: -3)),
        ]),
      );

      expect(
        find.text(
          'How did First Crit go? Add your debrief while you remember.',
        ),
        findsOneWidget,
      );

      await tapButton(tester, 'Add your debrief');
      await tapText(tester, 'Yes');
      await tapText(tester, 'No, I stayed with it');
      await tapButton(tester, 'Save');

      expect(find.textContaining('How did First Crit go?'), findsNothing);
    });

    testWidgets('an old race no longer nudges', (tester) async {
      await pumpApp(
        tester,
        prepare: seedRaces([
          testRace(name: 'Old Race', startsIn: const Duration(days: -40)),
        ]),
      );

      expect(find.textContaining('How did Old Race go?'), findsNothing);
    });

    testWidgets('with no races there is no race card', (tester) async {
      await pumpApp(tester);

      expect(find.text('Open race plan'), findsNothing);
    });
  });

  testWidgets('race prep reads in Filipino', (tester) async {
    await pumpApp(
      tester,
      deviceLocales: const [Locale('fil', 'PH')],
      prepare: seedRaces([testRace()]),
    );

    expect(find.text('Sa loob ng 5 araw'), findsOneWidget);
    expect(find.text('Linggo ng karera'), findsOneWidget);
  });
}
