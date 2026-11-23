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

/// Bump when the consent wording changes; a rider who agreed to version 1 has
/// not agreed to version 2.
const consentPolicyVersion = 1;

@freezed
abstract class ConsentRecord with _$ConsentRecord {
  const factory({
    required ConsentKind kind,
    required bool granted,
    required int policyVersion,
    required DateTime recordedAt,
  }) = _ConsentRecord;
}
