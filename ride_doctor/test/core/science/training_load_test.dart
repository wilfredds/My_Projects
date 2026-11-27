import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/core/science/training_load.dart';
import 'package:ride_doctor/core/time/calendar_day.dart';

final today = CalendarDay(2026, 11, 27); // a Friday

LoggedRide ride(int month, int day, {int minutes = 60, int effort = 5}) =>
    LoggedRide(
      day: CalendarDay(2026, month, day),
      minutes: minutes,
      effort: effort,
    );

/// Tuesday, Thursday and Saturday rides of 60 minutes at effort 5 (900 a
/// week) from Tuesday 20 October up to Thursday 26 November.
final List<LoggedRide> steady = [
  for (var d = CalendarDay(2026, 10, 20); !d.isAfter(today); d = d.addDays(1))
    if (d.weekday == DateTime.tuesday ||
        d.weekday == DateTime.thursday ||
        d.weekday == DateTime.saturday)
      LoggedRide(day: d, minutes: 60, effort: 5),
];

void main() {
  group('sessionLoad', () {
    test('effort x minutes', () {
      final load = sessionLoad(effort: 5, minutes: 60);
      expect(load.value, 300);
      expect(load.confidence, Confidence.estimated);
      expect(load.formula, Formula.sessionRpeLoad);
      expect(load.inputs, const [
        Input(Quantity.effortRating, 5),
        Input(Quantity.durationMinutes, 60),
      ]);
      expect(sessionLoad(effort: 0, minutes: 30).value, 0);
      expect(sessionLoad(effort: 10, minutes: 20).value, 200);
    });

    test('matches the worked example printed in the source', () {
      // Haddad M, et al. Front Neurosci. 2017;11:612 (PMC5673663), which
      // describes Foster's method: 87 minutes at a rating of 4 is 348.
      expect(sessionLoad(effort: 4, minutes: 87).value, 348);
    });

    test('rejects ratings outside 0-10 and impossible lengths', () {
      expect(() => sessionLoad(effort: 11, minutes: 60), throwsArgumentError);
      expect(() => sessionLoad(effort: -1, minutes: 60), throwsArgumentError);
      expect(() => sessionLoad(effort: 5, minutes: 0), throwsArgumentError);
      expect(() => sessionLoad(effort: 5, minutes: 1441), throwsArgumentError);
    });

    test('LoggedRide.load is the same product', () {
      expect(ride(11, 3, minutes: 90, effort: 4).load, 360);
    });
  });

  group('weeklyTotals', () {
    test('Monday-to-Sunday weeks, oldest first, empty weeks as zeros', () {
      final totals = weeklyTotals(
        today: today,
        rides: [
          ride(11, 23),
          ride(11, 25, minutes: 90, effort: 4),
          ride(11, 27, minutes: 45, effort: 7),
          ride(11, 16, minutes: 120, effort: 3),
          ride(11, 10, effort: 6),
          ride(11, 28), // tomorrow: ignored
          ride(10, 1), // before the six weeks: ignored
        ],
      );
      expect(totals.map((w) => w.weekStart.toIso()), [
        '2026-10-19',
        '2026-10-26',
        '2026-11-02',
        '2026-11-09',
        '2026-11-16',
        '2026-11-23',
      ]);
      expect(
        totals[0],
        WeekTotal(
          weekStart: CalendarDay(2026, 10, 19),
          rides: 0,
          minutes: 0,
          load: 0,
        ),
      );
      expect(totals[3].load, 360);
      expect(totals[4].minutes, 120);
      expect(
        totals[5],
        WeekTotal(
          weekStart: CalendarDay(2026, 11, 23),
          rides: 3,
          minutes: 195,
          load: 975,
        ),
      );
    });

    test('rejects zero weeks', () {
      expect(
        () => weeklyTotals(rides: const [], today: today, weeks: 0),
        throwsArgumentError,
      );
    });

    test('WeekTotal has value equality and describes itself', () {
      final a = WeekTotal(
        weekStart: today.weekStart,
        rides: 1,
        minutes: 60,
        load: 300,
      );
      expect(
        a,
        WeekTotal(weekStart: today.weekStart, rides: 1, minutes: 60, load: 300),
      );
      expect(
        a.hashCode,
        WeekTotal(
          weekStart: today.weekStart,
          rides: 1,
          minutes: 60,
          load: 300,
        ).hashCode,
      );
      expect(a.toString(), contains('300'));
    });
  });

  group('loadTrend', () {
    test('a steady rider: this week equals the usual week', () {
      final trend = loadTrend(rides: steady, today: today);
      // Last 7 days (21-27 Nov): Sat 21, Tue 24, Thu 26 = 900.
      expect(trend.value.recentLoad, 900);
      // 24 Oct - 20 Nov: 12 rides = 3600 over 4 weeks = 900 a week.
      expect(trend.value.usualWeekLoad, 900);
      expect(trend.value.ratio, 1);
      expect(trend.value.bigWeek, isFalse);
      expect(trend.confidence, Confidence.estimated);
      expect(trend.formula, Formula.loadTrend);
    });

    test('two extra long hard rides make a big week', () {
      final trend = loadTrend(
        rides: [
          ...steady,
          ride(11, 22, minutes: 120, effort: 7),
          ride(11, 25, minutes: 120, effort: 7),
        ],
        today: today,
      );
      expect(trend.value.recentLoad, 900 + 840 + 840);
      expect(trend.value.ratio, closeTo(2.867, 0.001));
      expect(trend.value.bigWeek, isTrue);
    });

    test('exactly 1.5 usual weeks is not yet flagged; more is', () {
      final atLimit = loadTrend(
        rides: [...steady, ride(11, 27, minutes: 90)], // +450
        today: today,
      );
      expect(atLimit.value.ratio, 1.5);
      expect(atLimit.value.bigWeek, isFalse);

      final over = loadTrend(
        rides: [...steady, ride(11, 27, minutes: 91)],
        today: today,
      );
      expect(over.value.bigWeek, isTrue);
    });

    test('a rider who started logging recently gets no comparison', () {
      final recentOnly = steady
          .where((r) => r.day.isAfter(CalendarDay(2026, 10, 24)))
          .toList();
      final trend = loadTrend(rides: recentOnly, today: today);
      expect(trend.value.usualWeekLoad, isNull);
      expect(trend.value.ratio, isNull);
      expect(trend.value.bigWeek, isFalse);
      expect(trend.confidence, Confidence.rough);
      expect(trend.improvements, const [Improvement.logEveryRide]);
    });

    test('four empty weeks before this one give no ratio', () {
      final trend = loadTrend(
        rides: [ride(10, 1), ride(11, 24), ride(11, 26)],
        today: today,
      );
      expect(trend.value.usualWeekLoad, 0);
      expect(trend.value.ratio, isNull);
      expect(trend.value.bigWeek, isFalse);
    });

    test('rides after today are ignored', () {
      final withFuture = loadTrend(
        rides: [...steady, ride(12, 1, minutes: 300, effort: 9)],
        today: today,
      );
      expect(withFuture.value.recentLoad, 900);
    });

    test('no rides at all', () {
      final trend = loadTrend(rides: const [], today: today);
      expect(trend.value.recentLoad, 0);
      expect(trend.value.ratio, isNull);
    });
  });
}
