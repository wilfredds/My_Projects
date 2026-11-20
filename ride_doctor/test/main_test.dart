import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/features/today/presentation/today_screen.dart';
import 'package:ride_doctor/main.dart' as app;

void main() {
  // Every other test builds the app through a helper. This one runs the real
  // entry point, so a mistake in main() itself cannot ship unnoticed.
  testWidgets('main() starts the app on the Today screen', (tester) async {
    app.main();
    await tester.pumpAndSettle();

    expect(find.byType(TodayScreen), findsOneWidget);
  });
}
