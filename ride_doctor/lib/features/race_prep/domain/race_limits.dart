import 'package:ride_doctor/features/profile/domain/number_rule.dart';

/// Realistic ranges for a race's numbers. Wide on purpose: they catch typos,
/// not unusual races.
abstract final class RaceLimits {
  static const distanceKm = NumberRule(min: 0.5, max: 1000);
  static const durationMinutes = NumberRule(min: 5, max: 1440, whole: true);
  static const laps = NumberRule(min: 1, max: 200, whole: true);
  static const lapLengthKm = NumberRule(min: 0.2, max: 100);
  static const cornerCount = NumberRule(min: 0, max: 50, whole: true);
  static const elevationGainM = NumberRule(min: 0, max: 10000, whole: true);
  static const travelMinutes = NumberRule(min: 0, max: 600, whole: true);
  static const placing = NumberRule(min: 1, max: 1000, whole: true);

  static const maxNameLength = 60;
}

/// Reads "06:30" or "6:30" as (hour, minute); null if it is not a real time.
(int, int)? parseClockTime(String text) {
  final match = RegExp(r'^(\d{1,2})[:.](\d{2})$').firstMatch(text.trim());
  if (match == null) return null;
  final hour = int.parse(match.group(1)!);
  final minute = int.parse(match.group(2)!);
  return hour > 23 || minute > 59 ? null : (hour, minute);
}
