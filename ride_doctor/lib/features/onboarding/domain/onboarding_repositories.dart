import 'package:ride_doctor/features/onboarding/domain/consent.dart';
import 'package:ride_doctor/features/onboarding/domain/readiness.dart';

abstract interface class ReadinessRepository {
  /// The most recent screening; null if never taken.
  Stream<ReadinessScreening?> watchLatest();

  Future<void> save(ReadinessScreening screening);
}

abstract interface class ConsentRepository {
  /// The current answer for every kind. A kind never asked about is false:
  /// consent is something given, never assumed. So is a "yes" given to an
  /// older wording than the kind's current one.
  Stream<Map<ConsentKind, bool>> watchCurrent();

  /// Appends a grant or withdrawal. History is never rewritten.
  Future<void> record(ConsentKind kind, {required bool granted});

  /// Every record ever made, oldest first.
  Future<List<ConsentRecord>> history();
}
