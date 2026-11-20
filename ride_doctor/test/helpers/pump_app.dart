import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/app/app.dart';

/// Starts the whole app, exactly as `main()` does, in a fresh provider scope.
///
/// [size] is in logical pixels. [textScale] simulates the system font-size
/// accessibility setting (2.0 = 200%).
Future<void> pumpApp(
  WidgetTester tester, {
  Size size = const Size(412, 915),
  double textScale = 1,
  List<Locale>? deviceLocales,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = textScale;
  if (deviceLocales != null) {
    tester.platformDispatcher.localesTestValue = deviceLocales;
  }
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearAllTestValues);

  await tester.pumpWidget(const ProviderScope(child: RideDoctorApp()));
  await tester.pumpAndSettle();
}
