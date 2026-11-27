import 'package:meta/meta.dart';
import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/constants.dart';
import 'package:ride_doctor/core/science/explained.dart';

/// Carbohydrate to aim for during a ride, in grams per hour.
@immutable
final class CarbGuidance {
  const new({required this.minGramsPerHour, required this.maxGramsPerHour});

  final int minGramsPerHour;
  final int maxGramsPerHour;

  /// False for short rides: water is usually enough.
  bool get needed => maxGramsPerHour > 0;

  @override
  bool operator ==(Object other) =>
      other is CarbGuidance &&
      other.minGramsPerHour == minGramsPerHour &&
      other.maxGramsPerHour == maxGramsPerHour;

  @override
  int get hashCode => Object.hash(minGramsPerHour, maxGramsPerHour);
}

/// How much carbohydrate to aim for during a ride of [rideMinutes]
/// (SCIENCE.md 7.12): none under an hour, 30-60 g/h up to two and a half
/// hours, 60-90 g/h beyond that. General guidance, not a personal plan.
Explained<CarbGuidance> carbohydrateDuringRide({required int rideMinutes}) {
  if (rideMinutes <= 0 || rideMinutes > 24 * 60) {
    throw ArgumentError.value(rideMinutes, 'rideMinutes', 'must be 1-1440');
  }
  final guidance = rideMinutes < fuelFromMinutes
      ? const CarbGuidance(minGramsPerHour: 0, maxGramsPerHour: 0)
      : rideMinutes <= longFuelFromMinutes
      ? const CarbGuidance(
          minGramsPerHour: moderateCarbMinGramsPerHour,
          maxGramsPerHour: moderateCarbMaxGramsPerHour,
        )
      : const CarbGuidance(
          minGramsPerHour: highCarbMinGramsPerHour,
          maxGramsPerHour: highCarbMaxGramsPerHour,
        );
  return Explained(
    value: guidance,
    confidence: Confidence.estimated,
    formula: Formula.carbohydrateByDuration,
    inputs: [Input(Quantity.durationMinutes, rideMinutes)],
    improvements: [if (guidance.needed) Improvement.practiseFuelling],
  );
}
