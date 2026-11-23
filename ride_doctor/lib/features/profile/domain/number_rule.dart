import 'package:meta/meta.dart';

/// Why a typed value was rejected. The UI turns this into a friendly,
/// translated message; the domain only names the problem.
enum NumberProblem { empty, notANumber, notWhole, tooLow, tooHigh }

/// The realistic range for one numeric field (PROMPT.md section 6:
/// "Validation: realistic ranges for every numeric field").
///
/// The ranges are deliberately wide - they exist to catch typos and unit
/// mix-ups (a weight of 700, a height of 17), not to judge anyone's body.
@immutable
final class NumberRule {
  const new({required this.min, required this.max, this.whole = false});

  final double min;
  final double max;

  /// True when only whole numbers make sense (beats per minute, teeth).
  final bool whole;

  /// Reads what a person typed. Accepts a comma as the decimal separator,
  /// since many keyboards and locales produce "72,5".
  static double? parse(String? text) {
    final cleaned = text?.trim().replaceAll(',', '.') ?? '';
    final value = double.tryParse(cleaned);
    // "NaN" and "Infinity" parse as doubles; nobody means them.
    return value == null || !value.isFinite ? null : value;
  }

  /// Returns the problem with [value], or null when it is acceptable.
  NumberProblem? check(double value) {
    if (whole && value != value.roundToDouble()) return NumberProblem.notWhole;
    if (value < min) return NumberProblem.tooLow;
    if (value > max) return NumberProblem.tooHigh;
    return null;
  }

  /// Validates raw text. An empty optional field is fine.
  NumberProblem? checkText(String? text, {bool required = true}) {
    if (text == null || text.trim().isEmpty) {
      return required ? NumberProblem.empty : null;
    }
    final value = parse(text);
    return value == null ? NumberProblem.notANumber : check(value);
  }
}

/// Every numeric range in the profile, in metric units.
abstract final class ProfileLimits {
  static const heightCm = NumberRule(min: 100, max: 250);
  static const weightKg = NumberRule(min: 30, max: 250);
  static const inseamMm = NumberRule(min: 500, max: 1100);
  static const restingHrBpm = NumberRule(min: 30, max: 120, whole: true);
  static const maxHrBpm = NumberRule(min: 100, max: 230, whole: true);
  static const lthrBpm = NumberRule(min: 90, max: 220, whole: true);
  static const ftpWatts = NumberRule(min: 50, max: 600, whole: true);
  static const yearsRiding = NumberRule(min: 0, max: 80);
  static const ridesPerWeek = NumberRule(min: 0, max: 14, whole: true);
  static const typicalRideMinutes = NumberRule(min: 10, max: 720, whole: true);
  static const hoursPerWeek = NumberRule(min: 0, max: 40);
  static const tyreWidthMm = NumberRule(min: 18, max: 130, whole: true);
  static const rollOutMm = NumberRule(min: 900, max: 2500);
  static const crankLengthMm = NumberRule(min: 140, max: 185);
  static const saddleHeightMm = NumberRule(min: 450, max: 950);
  static const tyrePressureKpa = NumberRule(min: 100, max: 900);
  static const chainringTeeth = NumberRule(min: 20, max: 60, whole: true);
  static const cogTeeth = NumberRule(min: 9, max: 52, whole: true);
  static const cassetteSpeeds = NumberRule(min: 5, max: 13, whole: true);

  static const maxNameLength = 40;

  /// Youngest and oldest rider the app accepts, in years.
  // TODO(france): the minimum age is a policy decision still open in
  /// docs/PRIVACY.md; 13 is a placeholder until it is made.
  static const minAgeYears = 13;
  static const maxAgeYears = 100;

  static NumberRule birthYear({required int currentYear}) => NumberRule(
    min: (currentYear - maxAgeYears).toDouble(),
    max: (currentYear - minAgeYears).toDouble(),
    whole: true,
  );
}

/// Parses "34, 50" or "11-13-15" into tooth counts, smallest first. Returns
/// null if anything in the text is not a whole number within [rule], or if
/// the list is empty or repeats a size.
List<int>? parseTeeth(String text, NumberRule rule) {
  final parts = text
      .split(RegExp(r'[,\s/\-]+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) return null;
  final teeth = <int>[];
  for (final part in parts) {
    final value = int.tryParse(part);
    if (value == null || rule.check(value.toDouble()) != null) return null;
    teeth.add(value);
  }
  teeth.sort();
  return teeth.toSet().length == teeth.length ? teeth : null;
}
