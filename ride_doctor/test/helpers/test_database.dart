import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:ride_doctor/core/database/app_database.dart';

/// A fresh, empty, in-memory database with the real schema.
///
/// `closeStreamsSynchronously` stops drift's watch streams from leaving a
/// timer pending after a widget test ends, which the test framework would
/// otherwise report as a failure.
AppDatabase newTestDatabase() => AppDatabase(
  DatabaseConnection(NativeDatabase.memory(), closeStreamsSynchronously: true),
);

/// A clock that returns a fixed instant, advanced by hand.
final class FakeClock {
  new([DateTime? start]) : now = start ?? DateTime.utc(2026, 11, 23, 8);

  DateTime now;

  DateTime call() => now;

  void advance(Duration by) => now = now.add(by);
}

/// Ids that count up: "id-1", "id-2", ... so tests can predict them.
String Function() sequentialIds() {
  var next = 0;
  return () => 'id-${++next}';
}
