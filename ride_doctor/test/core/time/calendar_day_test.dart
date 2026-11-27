import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/time/calendar_day.dart';

void main() {
  test('holds only year, month and day', () {
    final day = CalendarDay(2026, 11, 27);
    expect([day.year, day.month, day.day], [2026, 11, 27]);
    expect(day.weekday, DateTime.friday);
  });

  test('of() takes the date a moment falls on, ignoring the time', () {
    expect(
      CalendarDay.of(DateTime(2026, 11, 27, 23, 59)),
      CalendarDay(2026, 11, 27),
    );
    expect(
      CalendarDay.of(DateTime(2026, 11, 28, 0, 1)),
      CalendarDay(2026, 11, 28),
    );
  });

  group('arithmetic', () {
    test('adds and subtracts days across month and year ends', () {
      expect(CalendarDay(2026, 12, 31).addDays(1), CalendarDay(2027, 1, 1));
      expect(CalendarDay(2027, 3, 1).addDays(-1), CalendarDay(2027, 2, 28));
      expect(CalendarDay(2028, 3, 1).addDays(-1), CalendarDay(2028, 2, 29));
    });

    test('daysUntil counts whole dates in both directions', () {
      final a = CalendarDay(2026, 11, 27);
      expect(a.daysUntil(CalendarDay(2026, 12, 4)), 7);
      expect(CalendarDay(2026, 12, 4).daysUntil(a), -7);
      expect(a.daysUntil(a), 0);
    });

    test('is not thrown off by daylight-saving changes', () {
      // Dates around the 2027 US and EU clock changes: always 24 h apart.
      for (final start in [
        CalendarDay(2027, 3, 13),
        CalendarDay(2027, 10, 30),
      ]) {
        for (var i = 0; i < 5; i++) {
          expect(start.daysUntil(start.addDays(i)), i);
        }
      }
    });

    test('weekStart is the Monday on or before the date', () {
      expect(CalendarDay(2026, 11, 27).weekStart, CalendarDay(2026, 11, 23));
      expect(CalendarDay(2026, 11, 23).weekStart, CalendarDay(2026, 11, 23));
      expect(CalendarDay(2026, 11, 29).weekStart, CalendarDay(2026, 11, 23));
      expect(CalendarDay(2026, 11, 30).weekStart, CalendarDay(2026, 11, 30));
    });

    test('rolls over out-of-range parts like DateTime', () {
      expect(CalendarDay(2027, 1, 32), CalendarDay(2027, 2, 1));
    });
  });

  group('text form', () {
    test('toIso is zero-padded and sorts in date order', () {
      final days = [
        CalendarDay(2026, 12, 1),
        CalendarDay(2026, 9, 30),
        CalendarDay(2027, 1, 2),
      ];
      expect(days.map((d) => d.toIso()), [
        '2026-12-01',
        '2026-09-30',
        '2027-01-02',
      ]);
      final sortedByText = days.map((d) => d.toIso()).toList()..sort();
      final sortedByDate = [...days]..sort();
      expect(sortedByText, sortedByDate.map((d) => d.toIso()).toList());
    });

    test('parse reads what toIso writes', () {
      for (final day in [CalendarDay(2026, 1, 5), CalendarDay(2028, 2, 29)]) {
        expect(CalendarDay.parse(day.toIso()), day);
      }
    });

    test('parse rejects malformed and impossible dates', () {
      for (final text in [
        '2027-2-3',
        '27-02-03',
        '2027-02-30',
        '2027-13-01',
        '',
      ]) {
        expect(
          () => CalendarDay.parse(text),
          throwsFormatException,
          reason: text,
        );
      }
    });
  });

  test('at() gives the local wall-clock moment on that date', () {
    expect(CalendarDay(2026, 11, 27).at(5, 30), DateTime(2026, 11, 27, 5, 30));
  });

  test('compares, orders and hashes by date', () {
    final a = CalendarDay(2026, 11, 27);
    final b = CalendarDay(2026, 11, 28);
    expect(a.isBefore(b), isTrue);
    expect(b.isAfter(a), isTrue);
    expect(a.compareTo(b), lessThan(0));
    expect({a, CalendarDay(2026, 11, 27)}, hasLength(1));
    expect(a.toString(), '2026-11-27');
  });
}
