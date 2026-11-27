import 'package:meta/meta.dart';
import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/constants.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/core/time/calendar_day.dart';

/// One finished ride, as the load arithmetic needs it.
@immutable
final class LoggedRide {
  const new({required this.day, required this.minutes, required this.effort});

  final CalendarDay day;
  final int minutes;

  /// How hard the whole session felt, 0 (rest) to 10 (maximal), asked after
  /// the ride (session RPE on the CR-10 scale, SCIENCE.md 7.9).
  final int effort;

  /// Effort x minutes. A 60-minute ride rated 5 is 300.
  int get load => effort * minutes;
}

void _checkRide({required int effort, required int minutes}) {
  if (effort < 0 || effort > effortScaleMax) {
    throw ArgumentError.value(effort, 'effort', 'must be 0-$effortScaleMax');
  }
  if (minutes <= 0 || minutes > 24 * 60) {
    throw ArgumentError.value(minutes, 'minutes', 'must be 1-1440');
  }
}

/// Training load of one ride: effort rating x minutes (SCIENCE.md 7.9).
///
/// Estimated: it is a published method applied to what the rider reported,
/// and a rating is a feeling, not a measurement.
Explained<int> sessionLoad({required int effort, required int minutes}) {
  _checkRide(effort: effort, minutes: minutes);
  return Explained(
    value: effort * minutes,
    confidence: Confidence.estimated,
    formula: Formula.sessionRpeLoad,
    inputs: [
      Input(Quantity.effortRating, effort),
      Input(Quantity.durationMinutes, minutes),
    ],
    improvements: const [Improvement.logEveryRide],
  );
}

/// Totals for one calendar week (Monday to Sunday).
@immutable
final class WeekTotal {
  const new({
    required this.weekStart,
    required this.rides,
    required this.minutes,
    required this.load,
  });

  final CalendarDay weekStart;
  final int rides;
  final int minutes;
  final int load;

  @override
  bool operator ==(Object other) =>
      other is WeekTotal &&
      other.weekStart == weekStart &&
      other.rides == rides &&
      other.minutes == minutes &&
      other.load == load;

  @override
  int get hashCode => Object.hash(weekStart, rides, minutes, load);

  @override
  String toString() =>
      'WeekTotal($weekStart: $rides rides, $minutes min, $load)';
}

/// Totals for the [weeks] calendar weeks ending with the one that contains
/// [today], oldest first. A week with no rides is a zero, not a gap, so a
/// chart of them never skips a week. Rides after [today] are ignored.
List<WeekTotal> weeklyTotals({
  required Iterable<LoggedRide> rides,
  required CalendarDay today,
  int weeks = 6,
}) {
  if (weeks < 1) throw ArgumentError.value(weeks, 'weeks', 'must be >= 1');
  final firstWeek = today.weekStart.addDays(-7 * (weeks - 1));
  final counts = List.filled(weeks, 0);
  final minutes = List.filled(weeks, 0);
  final loads = List.filled(weeks, 0);
  for (final ride in rides) {
    if (ride.day.isAfter(today) || ride.day.isBefore(firstWeek)) continue;
    final index = firstWeek.daysUntil(ride.day) ~/ 7;
    counts[index]++;
    minutes[index] += ride.minutes;
    loads[index] += ride.load;
  }
  return [
    for (var i = 0; i < weeks; i++)
      WeekTotal(
        weekStart: firstWeek.addDays(7 * i),
        rides: counts[i],
        minutes: minutes[i],
        load: loads[i],
      ),
  ];
}

/// The last 7 days compared with the rider's usual week.
@immutable
final class LoadTrend {
  const new({required this.recentLoad, this.usualWeekLoad});

  /// Load over the last 7 days, today included.
  final int recentLoad;

  /// Average weekly load over the 4 weeks before those 7 days. Null when the
  /// rider has not been logging long enough for an average to mean anything.
  final double? usualWeekLoad;

  /// recentLoad / usualWeekLoad. Null without a usual week to compare with,
  /// including after four empty weeks (no ratio can be taken from zero).
  double? get ratio {
    final usual = usualWeekLoad;
    if (usual == null || usual == 0) return null;
    return recentLoad / usual;
  }

  /// True when the last 7 days are more than [bigWeekRatio] usual weeks.
  bool get bigWeek {
    final r = ratio;
    return r != null && r > bigWeekRatio;
  }
}

/// How the last 7 days compare with the 4 weeks before them (SCIENCE.md 7.9).
///
/// Needs the rider to have logged since at least the start of those 4 weeks;
/// otherwise days before they started logging would count as days off, the
/// usual week would look too small, and every week would look "big".
Explained<LoadTrend> loadTrend({
  required Iterable<LoggedRide> rides,
  required CalendarDay today,
}) {
  final recentStart = today.addDays(1 - recentWindowDays);
  final usualStart = recentStart.addDays(-usualWindowDays);
  var recent = 0;
  var usual = 0;
  CalendarDay? firstLogged;
  for (final ride in rides) {
    if (ride.day.isAfter(today)) continue;
    if (firstLogged == null || ride.day.isBefore(firstLogged)) {
      firstLogged = ride.day;
    }
    if (!ride.day.isBefore(recentStart)) {
      recent += ride.load;
    } else if (!ride.day.isBefore(usualStart)) {
      usual += ride.load;
    }
  }
  final enoughHistory = firstLogged != null && !firstLogged.isAfter(usualStart);
  final trend = LoadTrend(
    recentLoad: recent,
    usualWeekLoad: enoughHistory ? usual / (usualWindowDays / 7) : null,
  );
  return Explained(
    value: trend,
    confidence: enoughHistory ? Confidence.estimated : Confidence.rough,
    formula: Formula.loadTrend,
    inputs: [
      Input(Quantity.sessionLoad, recent),
      if (trend.usualWeekLoad case final usualWeek?)
        Input(Quantity.usualWeekLoad, usualWeek.round()),
    ],
    improvements: const [Improvement.logEveryRide],
  );
}
