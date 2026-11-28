import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/time/calendar_day.dart';
import 'package:ride_doctor/core/time/clock_time.dart';

void main() {
  test('holds a time of day and joins a date', () {
    final time = ClockTime(5, 30);
    expect(time.minutesOfDay, 330);
    expect(time.on(CalendarDay(2026, 11, 28)), DateTime(2026, 11, 28, 5, 30));
    expect(ClockTime(19).minute, 0);
  });

  test('rejects impossible times', () {
    expect(() => ClockTime(24), throwsArgumentError);
    expect(() => ClockTime(-1), throwsArgumentError);
    expect(() => ClockTime(5, 60), throwsArgumentError);
    expect(() => ClockTime(5, -1), throwsArgumentError);
  });

  test('text form round-trips and rejects nonsense', () {
    expect(ClockTime(5, 30).toString(), '05:30');
    expect(ClockTime.parse('05:30'), ClockTime(5, 30));
    expect(ClockTime.parse(' 23:59 '), ClockTime(23, 59));
    for (final bad in ['5:30', '24:00', '05:60', '05-30', '', 'ab:cd']) {
      expect(() => ClockTime.parse(bad), throwsFormatException, reason: bad);
    }
  });

  test('orders, compares and hashes', () {
    final times = [ClockTime(19, 30), ClockTime(5, 30), ClockTime(5)];
    expect(times..sort(), [ClockTime(5), ClockTime(5, 30), ClockTime(19, 30)]);
    expect(ClockTime(5, 30), ClockTime(5, 30));
    expect(ClockTime(5, 30).hashCode, ClockTime(5, 30).hashCode);
    expect(ClockTime(5, 30), isNot(ClockTime(5, 31)));
  });
}
