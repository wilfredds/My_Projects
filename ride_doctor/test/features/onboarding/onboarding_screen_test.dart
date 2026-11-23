import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/features/onboarding/presentation/onboarding_screen.dart';
import 'package:ride_doctor/features/today/presentation/today_screen.dart';

import '../../helpers/pump_app.dart';

Future<void> next(WidgetTester tester) => tapText(tester, 'Next');

Future<void> fillAbout(WidgetTester tester, {String weight = '58.5'}) async {
  await enterField(tester, 'What should we call you?', 'France');
  await enterField(tester, 'Birth year', '2004');
  await enterField(tester, 'Height', '165');
  await enterField(tester, 'Weight', weight);
}

Future<void> fillRiding(WidgetTester tester) async {
  await tapText(tester, 'Road');
  await tapText(tester, 'Race faster');
  await enterField(tester, 'Years riding', '1.5');
  await enterField(tester, 'Rides per week', '4');
  await enterField(tester, 'Typical ride length', '90');
  await enterField(tester, 'Hours you can ride per week', '8');
}

/// Answers all seven readiness questions, "yes" to the first [yesCount].
Future<void> answerReadiness(WidgetTester tester, {int yesCount = 0}) async {
  for (var i = 0; i < 7; i++) {
    final choice = find.text(i < yesCount ? 'Yes' : 'No').at(i);
    await tester.ensureVisible(choice);
    await tester.pumpAndSettle();
    await tester.tap(choice);
    await tester.pumpAndSettle();
  }
}

void main() {
  testWidgets('the whole flow saves a profile and lands on Today', (
    tester,
  ) async {
    final database = await pumpApp(tester, onboarded: false);

    await fillAbout(tester);
    await next(tester);
    expect(find.text('Step 2 of 4'), findsOneWidget);
    await fillRiding(tester);
    await next(tester);
    expect(find.text('Step 3 of 4'), findsOneWidget);
    await answerReadiness(tester);
    await next(tester);
    expect(find.text('Step 4 of 4'), findsOneWidget);
    await tapText(tester, 'Store my body and health information');
    await tapText(tester, 'Finish');

    expect(find.byType(TodayScreen), findsOneWidget);
    expect(find.text('Hi, France'), findsOneWidget);

    final rider = await database.select(database.riderProfiles).getSingle();
    expect(rider.displayName, 'France');
    expect(rider.birthYear, 2004);
    expect(rider.heightCm, 165);
    expect(rider.weightKg, 58.5);
    expect(rider.goal, 'raceFaster');
    expect(rider.ridesPerWeek, 4);
    final bike = await database.select(database.bikes).getSingle();
    expect(bike.bikeType, 'road');
    final consents = await database.select(database.consentRecords).get();
    expect(
      {for (final row in consents) row.kind: row.granted},
      {'healthData': true, 'location': false, 'notifications': false},
    );
    final screening = await database
        .select(database.readinessScreenings)
        .getSingle();
    expect(screening.anyYes, isFalse);
  });

  testWidgets('Next with nothing filled in shows what is missing and stays', (
    tester,
  ) async {
    await pumpApp(tester, onboarded: false);

    await next(tester);

    expect(find.text('Step 1 of 4'), findsOneWidget);
    expect(find.text('Please fill this in.'), findsNWidgets(4));
  });

  testWidgets('an unrealistic weight is caught with the allowed range', (
    tester,
  ) async {
    await pumpApp(tester, onboarded: false);

    await fillAbout(tester, weight: '700');
    await next(tester);

    expect(find.text('Step 1 of 4'), findsOneWidget);
    expect(
      find.text('That looks too high. Enter 250 kg or less.'),
      findsOneWidget,
    );
  });

  testWidgets('in imperial units, pounds and inches are converted on save', (
    tester,
  ) async {
    final database = await pumpApp(tester, onboarded: false);

    await tapText(tester, 'Imperial (lb, in, mi)');
    await enterField(tester, 'What should we call you?', 'France');
    await enterField(tester, 'Birth year', '2004');
    await enterField(tester, 'Height', '65');
    await enterField(tester, 'Weight', '129');
    await next(tester);
    await fillRiding(tester);
    await next(tester);
    await answerReadiness(tester);
    await next(tester);
    await tapText(tester, 'Store my body and health information');
    await tapText(tester, 'Finish');

    final rider = await database.select(database.riderProfiles).getSingle();
    expect(rider.heightCm, closeTo(165.1, 0.01));
    expect(rider.weightKg, closeTo(58.51, 0.01));
  });

  testWidgets('a height typed in the wrong unit shows the limit in the unit '
      'being typed', (tester) async {
    await pumpApp(tester, onboarded: false);

    await tapText(tester, 'Imperial (lb, in, mi)');
    await fillAbout(tester); // 165 "inches"
    await next(tester);

    expect(
      find.text('That looks too high. Enter 98.4 in or less.'),
      findsOneWidget,
    );
  });

  testWidgets('step 2 needs a bike type and a goal', (tester) async {
    await pumpApp(tester, onboarded: false);
    await fillAbout(tester);
    await next(tester);

    await enterField(tester, 'Years riding', '1.5');
    await enterField(tester, 'Rides per week', '4');
    await enterField(tester, 'Typical ride length', '90');
    await enterField(tester, 'Hours you can ride per week', '8');
    await next(tester);

    expect(find.text('Step 2 of 4'), findsOneWidget);
    expect(find.text('Please fill this in.'), findsNWidgets(2));
  });

  testWidgets('Back keeps what was typed', (tester) async {
    await pumpApp(tester, onboarded: false);
    await fillAbout(tester);
    await next(tester);

    await tapText(tester, 'Back');

    expect(find.text('Step 1 of 4'), findsOneWidget);
    expect(find.text('France'), findsOneWidget);
    expect(find.text('58.5'), findsOneWidget);
  });

  testWidgets('every readiness question must be answered', (tester) async {
    await pumpApp(tester, onboarded: false);
    await fillAbout(tester);
    await next(tester);
    await fillRiding(tester);
    await next(tester);

    await next(tester);

    expect(find.text('Step 3 of 4'), findsOneWidget);
    expect(find.text('Please answer every question.'), findsNWidgets(7));
  });

  testWidgets('a "yes" shows the doctor recommendation but never blocks', (
    tester,
  ) async {
    final database = await pumpApp(tester, onboarded: false);
    await fillAbout(tester);
    await next(tester);
    await fillRiding(tester);
    await next(tester);

    expect(find.byType(ReadinessAdvice), findsNothing);
    await answerReadiness(tester, yesCount: 1);
    expect(find.byType(ReadinessAdvice), findsOneWidget);
    expect(find.text('Check with a doctor first'), findsOneWidget);

    await next(tester);
    await tapText(tester, 'Store my body and health information');
    await tapText(tester, 'Finish');

    // Still let in, and the recommendation follows them to Today.
    expect(find.byType(TodayScreen), findsOneWidget);
    expect(find.text('Check with a doctor first'), findsOneWidget);
    final screening = await database
        .select(database.readinessScreenings)
        .getSingle();
    expect(screening.anyYes, isTrue);
  });

  testWidgets('without health-data consent nothing is stored', (tester) async {
    final database = await pumpApp(tester, onboarded: false);
    await fillAbout(tester);
    await next(tester);
    await fillRiding(tester);
    await next(tester);
    await answerReadiness(tester);
    await next(tester);

    // Grant only the optional ones.
    await tapText(tester, 'Use my location');
    await tapText(tester, 'Finish');

    expect(find.byType(OnboardingScreen), findsOneWidget);
    expect(
      find.text('Ride Doctor cannot save a profile without this.'),
      findsOneWidget,
    );
    expect(await database.select(database.riderProfiles).get(), isEmpty);
    expect(await database.select(database.consentRecords).get(), isEmpty);
  });

  testWidgets('optional consents are stored exactly as chosen', (tester) async {
    final database = await pumpApp(tester, onboarded: false);
    await fillAbout(tester);
    await next(tester);
    await fillRiding(tester);
    await next(tester);
    await answerReadiness(tester);
    await next(tester);

    await tapText(tester, 'Store my body and health information');
    await tapText(tester, 'Send me reminders');
    await tapText(tester, 'Finish');

    final consents = await database.select(database.consentRecords).get();
    expect(
      {for (final row in consents) row.kind: row.granted},
      {'healthData': true, 'location': false, 'notifications': true},
    );
  });

  testWidgets('the medical disclaimer is shown before finishing', (
    tester,
  ) async {
    await pumpApp(tester, onboarded: false);
    await fillAbout(tester);
    await next(tester);
    await fillRiding(tester);
    await next(tester);
    await answerReadiness(tester);
    await next(tester);

    expect(find.text('Not a medical device'), findsOneWidget);
  });

  testWidgets('the whole flow works in Filipino', (tester) async {
    await pumpApp(
      tester,
      onboarded: false,
      deviceLocales: const [Locale('fil', 'PH')],
    );

    expect(find.text('Hakbang 1 sa 4'), findsOneWidget);
    expect(find.text('Tungkol sa iyo'), findsOneWidget);
    await tapText(tester, 'Susunod');
    expect(find.text('Pakisagutan ito.'), findsNWidgets(4));
  });
}
