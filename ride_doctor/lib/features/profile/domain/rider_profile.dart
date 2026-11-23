import 'package:freezed_annotation/freezed_annotation.dart';

part 'rider_profile.freezed.dart';

/// Asked only because one or two formulas differ by sex, always optional.
enum Sex { female, male, preferNotToSay }

enum RidingGoal {
  finishFirstRace,
  raceFaster,
  ridePainFree,
  buildEndurance,
  generalFitness,
}

/// What the app knows about the rider. Everything is metric here; the UI
/// converts for display.
///
/// The required fields are the onboarding essentials. The optional ones are
/// asked for later, at the moment a feature can use them.
@freezed
abstract class RiderProfile with _$RiderProfile {
  const factory({
    required String displayName,
    required int birthYear,
    required double heightCm,
    required double weightKg,
    required double yearsRiding,
    required int ridesPerWeek,
    required int typicalRideMinutes,
    required double hoursPerWeek,
    required RidingGoal goal,
    Sex? sex,
    double? inseamMm,
    int? restingHrBpm,
    int? maxHrBpm,
    int? ftpWatts,
    int? lthrBpm,
  }) = _RiderProfile;
}
