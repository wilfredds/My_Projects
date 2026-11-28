import 'package:meta/meta.dart';
import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/constants.dart';
import 'package:ride_doctor/core/science/explained.dart';

/// What a rider weighed and drank around one ride (SCIENCE.md 7.11).
@immutable
final class SweatTest {
  const new({
    required this.weightBeforeKg,
    required this.weightAfterKg,
    required this.drankLitres,
    required this.minutes,
    this.urineLitres = 0,
  });

  final double weightBeforeKg;
  final double weightAfterKg;
  final double drankLitres;
  final double urineLitres;
  final int minutes;

  /// Body mass lost as a percentage of the starting weight. Negative when
  /// the rider weighed more after the ride than before.
  double get massChangePercent =>
      (weightBeforeKg - weightAfterKg) / weightBeforeKg * 100;
}

/// What the weigh-in says about the rider's drinking on that ride.
enum DrinkingVerdict {
  /// Weighed more after than before: drank more than they sweated, which can
  /// dilute the blood's sodium (hyponatraemia). Drink less next time.
  drankTooMuch,

  /// Lost no more than 2% of body mass.
  aboutRight,

  /// Lost more than 2%: drink a little more next time.
  drankTooLittle,
}

DrinkingVerdict drinkingVerdict(SweatTest test) {
  _check(test);
  final change = test.massChangePercent;
  if (change < 0) return DrinkingVerdict.drankTooMuch;
  // A hair of tolerance: (60 - 58.8) / 60 * 100 is 2.0000000000000044 in
  // floating point, and exactly 2% must count as "about right".
  if (change > maxBodyMassLossPercent + 1e-9) {
    return DrinkingVerdict.drankTooLittle;
  }
  return DrinkingVerdict.aboutRight;
}

void _check(SweatTest test) {
  bool inRange(double value, double min, double max) =>
      value >= min && value <= max;
  if (!inRange(test.weightBeforeKg, 30, 250) ||
      !inRange(test.weightAfterKg, 30, 250)) {
    throw ArgumentError('weights must be 30-250 kg');
  }
  // More than 5 kg either way in one ride is a typo, not sweat.
  if ((test.weightBeforeKg - test.weightAfterKg).abs() > 5) {
    throw ArgumentError('before and after differ by more than 5 kg');
  }
  if (!inRange(test.drankLitres, 0, 10) || !inRange(test.urineLitres, 0, 5)) {
    throw ArgumentError('drink 0-10 L and urine 0-5 L');
  }
  if (test.minutes < 15 || test.minutes > 600) {
    throw ArgumentError.value(test.minutes, 'minutes', 'must be 15-600');
  }
}

/// True when a sweat rate is high enough that the entries are worth a second
/// look (SCIENCE.md 7.11).
bool looksUnusuallyHigh(double litresPerHour) =>
    litresPerHour > unusualSweatRateLitresPerHour;

/// Sweat rate in litres per hour: (weight before - weight after + drink -
/// urine) / hours, taking 1 kg lost as 1 litre (SCIENCE.md 7.11).
///
/// Measured: it comes from the rider's own weigh-in, in their own
/// conditions - but only for conditions like that ride's.
Explained<double> sweatRate(SweatTest test) {
  _check(test);
  final litres =
      (test.weightBeforeKg - test.weightAfterKg) * litresPerKgLost +
      test.drankLitres -
      test.urineLitres;
  // A negative result means the numbers do not add up (for example urine
  // entered as drink). Report zero rather than a negative sweat rate.
  final perHour = litres < 0 ? 0.0 : litres / (test.minutes / 60);
  return Explained(
    value: perHour,
    confidence: Confidence.measured,
    formula: Formula.sweatRate,
    inputs: [
      Input(Quantity.bodyMassBeforeKg, test.weightBeforeKg),
      Input(Quantity.bodyMassAfterKg, test.weightAfterKg),
      Input(Quantity.fluidDrunkLitres, test.drankLitres),
      Input(Quantity.urineLitres, test.urineLitres),
      Input(Quantity.durationMinutes, test.minutes),
    ],
  );
}
