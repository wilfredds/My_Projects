import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:ride_doctor/features/onboarding/presentation/onboarding_screen.dart';
import 'package:ride_doctor/features/settings/presentation/privacy_screen.dart';

import '../../helpers/pump_app.dart';

Future<void> openPrivacy(WidgetTester tester) async {
  await tester.tap(find.byIcon(Icons.settings_outlined));
  await tester.pumpAndSettle();
  await tapText(tester, 'Privacy and your data');
  expect(find.byType(PrivacyScreen), findsOneWidget);
}

SwitchListTile consentSwitch(WidgetTester tester, String title) =>
    tester.widget(find.widgetWithText(SwitchListTile, title));

void main() {
  testWidgets('shows the consents exactly as they were given', (tester) async {
    await pumpApp(tester);
    await openPrivacy(tester);

    expect(find.textContaining('Granted.'), findsOneWidget);
    expect(find.byIcon(Icons.check_circle_outline), findsOneWidget);
    expect(consentSwitch(tester, 'Use my location').value, isFalse);
    expect(consentSwitch(tester, 'Send me reminders').value, isFalse);
  });

  testWidgets('health consent is a fact, not a switch: it cannot be turned '
      'off while the data is still stored', (tester) async {
    await pumpApp(tester);
    await openPrivacy(tester);

    expect(
      find.widgetWithText(
        SwitchListTile,
        'Store my body and health information',
      ),
      findsNothing,
    );
    expect(find.byType(SwitchListTile), findsNWidgets(2));
  });

  testWidgets('granting then withdrawing location keeps both records', (
    tester,
  ) async {
    final database = await pumpApp(tester);
    await openPrivacy(tester);

    await tapText(tester, 'Use my location');
    expect(consentSwitch(tester, 'Use my location').value, isTrue);
    await tapText(tester, 'Use my location');
    expect(consentSwitch(tester, 'Use my location').value, isFalse);

    final location = (await database.select(database.consentRecords).get())
        .where((row) => row.kind == 'location')
        .map((row) => row.granted)
        .toList();
    // Seeded "no", then "yes", then "no": history is appended, never edited.
    expect(location, [false, true, false]);
  });

  testWidgets('export shows everything stored, and copies it', (tester) async {
    String? clipboard;
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'Clipboard.setData') {
          clipboard =
              (call.arguments as Map<Object?, Object?>)['text']! as String;
        }
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );
    await pumpApp(tester, bike: testBike);
    await openPrivacy(tester);

    await tapButton(tester, 'Export my data');

    expect(find.textContaining('"display_name": "France"'), findsOneWidget);
    await tester.tap(find.text('Copy to clipboard'));
    await tester.pumpAndSettle();

    expect(clipboard, contains('"rider_profiles"'));
    expect(clipboard, contains('"consent_records"'));
    expect(clipboard, contains('"chainrings": "34,50"'));
    expect(clipboard, contains('"schemaVersion": 1'));
  });

  testWidgets('cancelling the delete confirmation deletes nothing', (
    tester,
  ) async {
    final database = await pumpApp(tester);
    await openPrivacy(tester);

    await tapButton(tester, 'Delete everything');
    expect(find.text('Delete everything?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();

    expect(find.byType(PrivacyScreen), findsOneWidget);
    expect(await database.select(database.riderProfiles).get(), hasLength(1));
  });

  testWidgets('deleting everything empties the database and restarts '
      'onboarding', (tester) async {
    final database = await pumpApp(tester, bike: testBike);
    await tester.tap(find.byIcon(Icons.settings_outlined));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Dark'));
    await tester.pumpAndSettle();
    await tapText(tester, 'Privacy and your data');

    await tapButton(tester, 'Delete everything');
    await tester.tap(find.text('Delete'));
    await tester.pumpAndSettle();

    expect(find.byType(OnboardingScreen), findsOneWidget);
    for (final table in database.allTables) {
      final rows = await database
          .customSelect('SELECT * FROM "${table.actualTableName}"')
          .get();
      expect(rows, isEmpty, reason: table.actualTableName);
    }
    // Settings went back to their defaults too.
    expect(
      Theme.of(tester.element(find.byType(OnboardingScreen))).brightness,
      Brightness.light,
    );
  });
}
