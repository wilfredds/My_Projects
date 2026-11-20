import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ride_doctor/app/app.dart';

void main() {
  // ProviderScope owns every provider's state. Keeping it at the very root
  // means tests can replace any dependency by wrapping the app in their own
  // scope with overrides - no global singletons to reset between tests.
  runApp(const ProviderScope(child: RideDoctorApp()));
}
