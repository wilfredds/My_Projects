import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/time/calendar_day.dart';
import 'package:ride_doctor/core/time/clock_time.dart';
import 'package:ride_doctor/features/reminders/domain/reminders.dart';

final today = CalendarDay(2026, 11, 28);

ReminderSettings settings({bool morning = true, bool evening = true}) =>
    ReminderSettings.defaults.copyWith(morningOn: morning, eveningOn: evening);

void main() {
  group('ReminderSettings', () {
    test('both off by default, at 05:30 and 19:30', () {
      final defaults = ReminderSettings.defaults;
      expect(defaults.anyOn, isFalse);
      expect(defaults.timeOf(ReminderKind.morning), ClockTime(5, 30));
      expect(defaults.timeOf(ReminderKind.evening), ClockTime(19, 30));
    });

    test('copyWith and equality', () {
      final changed = ReminderSettings.defaults.copyWith(
        eveningOn: true,
        eveningAt: ClockTime(21),
      );
      expect(changed.isOn(ReminderKind.evening), isTrue);
      expect(changed.isOn(ReminderKind.morning), isFalse);
      expect(changed.anyOn, isTrue);
      expect(
        changed,
        ReminderSettings(
          morningAt: ClockTime(5, 30),
          eveningAt: ClockTime(21),
          eveningOn: true,
        ),
      );
      expect(changed.hashCode, changed.copyWith().hashCode);
      expect(changed, isNot(ReminderSettings.defaults));
    });
  });

  group('reminderId', () {
    test('fallbacks are 1 and 2; dated ones 100+ and 200+', () {
      expect(reminderId(ReminderKind.morning), 1);
      expect(reminderId(ReminderKind.evening), 2);
      expect(reminderId(ReminderKind.morning, dayOffset: 0), 100);
      expect(reminderId(ReminderKind.evening, dayOffset: 6), 206);
      expect(
        () => reminderId(ReminderKind.morning, dayOffset: 7),
        throwsArgumentError,
      );
      expect(
        () => reminderId(ReminderKind.morning, dayOffset: -1),
        throwsArgumentError,
      );
    });
  });

  group('planReminders', () {
    test('nothing on, nothing planned', () {
      expect(
        planReminders(settings: ReminderSettings.defaults, now: today.at(4)),
        isEmpty,
      );
    });

    test('a week of dated reminders, then a daily fallback', () {
      final planned = planReminders(
        settings: settings(evening: false),
        now: today.at(4),
      );
      expect(planned, hasLength(8));
      expect(
        planned.first,
        PlannedReminder(
          id: 100,
          kind: ReminderKind.morning,
          at: today.at(5, 30),
          day: today,
        ),
      );
      expect(planned[6].at, today.addDays(6).at(5, 30));
      expect(planned[6].id, 106);
      final fallback = planned.last;
      expect(fallback.repeatsDaily, isTrue);
      expect(fallback.id, 1);
      expect(fallback.at, today.addDays(7).at(5, 30));
      expect(fallback.day, isNull);
      // Ids never repeat, so scheduling one never replaces another.
      expect(planned.map((r) => r.id).toSet(), hasLength(planned.length));
    });

    test("today's reminder is left out once its time has passed", () {
      final planned = planReminders(
        settings: settings(evening: false),
        now: today.at(5, 30), // exactly the time: already too late
      );
      expect(planned.first.day, today.addDays(1));
      expect(planned.first.id, 101);
      expect(planned, hasLength(7));
    });

    test('morning and evening are planned independently', () {
      final planned = planReminders(settings: settings(), now: today.at(12));
      final mornings = planned.where((r) => r.kind == ReminderKind.morning);
      final evenings = planned.where((r) => r.kind == ReminderKind.evening);
      expect(mornings.first.day, today.addDays(1)); // 05:30 has gone
      expect(evenings.first.day, today); // 19:30 is still to come
      expect(evenings.first.at, today.at(19, 30));
      expect(planned.where((r) => r.repeatsDaily), hasLength(2));
    });

    test(
      'a skipped day gets no reminder, and the fallback does not fill in',
      () {
        final skipDay = today.addDays(2);
        final planned = planReminders(
          settings: settings(evening: false),
          now: today.at(4),
          skip: (kind, day) => kind == ReminderKind.morning && day == skipDay,
        );
        expect(planned.map((r) => r.day), isNot(contains(skipDay)));
        expect(planned, hasLength(7));
        expect(planned.last.at, today.addDays(7).at(5, 30));
      },
    );

    test('dates roll over months and years', () {
      final planned = planReminders(
        settings: settings(evening: false),
        now: DateTime(2026, 12, 29, 4),
      );
      expect(planned.map((r) => r.at.day).take(7), [29, 30, 31, 1, 2, 3, 4]);
      expect(planned[3].at, DateTime(2027, 1, 1, 5, 30));
    });

    test('PlannedReminder describes itself', () {
      final fallback = planReminders(
        settings: settings(evening: false),
        now: today.at(4),
      ).last;
      expect(fallback.toString(), contains('daily'));
      expect(fallback.hashCode, isA<int>());
    });
  });
}
