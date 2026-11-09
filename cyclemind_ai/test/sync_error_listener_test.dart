import 'package:cyclemind_ai/core/providers/sync_errors.dart';
import 'package:cyclemind_ai/core/widgets/sync_error_listener.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// A write reported as saved offline and later rejected is rolled back on the
/// device silently (premise C11c). This is the notice that replaces silence.
void main() {
  testWidgets('every rejected offline save is announced, even two identical '
      'ones in a row', (tester) async {
    final errors = SyncErrors();
    addTearDown(errors.dispose);
    await tester.pumpWidget(ProviderScope(
      overrides: [syncErrorsProvider.overrideWithValue(errors)],
      child: MaterialApp(
        // Mounted exactly as app.dart mounts it.
        builder: (context, child) => SyncErrorListener(child: child!),
        home: const Scaffold(body: SizedBox.shrink()),
      ),
    ));

    const message = "Couldn't sync a ride you logged offline, so it was removed.";

    Future<void> announce() async {
      errors.report(message);
      await tester.pump(); // deliver the event
      await tester.pump(const Duration(milliseconds: 300)); // snackbar in
    }

    Future<void> letItTimeOut() async {
      await tester.pump(const Duration(seconds: 5));
      await tester.pump(const Duration(seconds: 1));
    }

    await announce();
    expect(find.text(message), findsOneWidget);
    await letItTimeOut();
    expect(find.text(message), findsNothing);

    // A StreamProvider would merge equal values into one notice. Two rides
    // rejected in a row must be two notices.
    await announce();
    expect(find.text(message), findsOneWidget);
    await letItTimeOut();
  });
}
