import 'package:freezed_annotation/freezed_annotation.dart';

part 'consent.freezed.dart';

/// The three things we ask permission for, each on its own (PROMPT.md 10).
enum ConsentKind {
  /// Storing body, health-readiness and symptom data on this device. Without
  /// it the app cannot keep a profile at all.
  healthData,
  location,
  notifications,
}

/// Which wording of each consent is current.
///
/// Bump a kind's number whenever what it covers changes. A rider who agreed
/// to an older wording has not agreed to the new one, so their earlier "yes"
/// stops counting and the app asks again.
///
/// History:
/// - healthData 1 (2026-11-20): profile, readiness answers, symptom reports.
/// - location 1 (2026-11-20): "not used yet; you will be asked again".
///   location 2 (2026-11-27, preview only): the chosen town's approximate
///   position is sent to the weather service (Open-Meteo).
///   location 3 (2026-11-28): also says the typed search text goes to
///   Open-Meteo, and that its server logs can keep both for 90 days.
/// - notifications 1 (2026-11-20): "not used yet; you will be asked again".
///   notifications 2 (Phase 3): a morning plan reminder and an evening
///   check-in reminder, scheduled on the phone.
extension ConsentPolicy on ConsentKind {
  int get currentPolicyVersion => switch (this) {
    ConsentKind.healthData => 1,
    ConsentKind.location => 3,
    ConsentKind.notifications => 2,
  };
}

@freezed
abstract class ConsentRecord with _$ConsentRecord {
  const factory({
    required ConsentKind kind,
    required bool granted,
    required int policyVersion,
    required DateTime recordedAt,
  }) = _ConsentRecord;
}
