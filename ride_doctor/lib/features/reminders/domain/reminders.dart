import 'package:meta/meta.dart';
import 'package:ride_doctor/core/time/calendar_day.dart';
import 'package:ride_doctor/core/time/clock_time.dart';

/// The two reminders the app offers (PROMPT.md section 8, Phase 3).
enum ReminderKind {
  /// Today's session, heat and best ride window.
  morning,

  /// "How did today go?" - the check-in that adjusts the next days.
  evening,
}

/// The rider's reminder choices. Both are off until the rider turns one on
/// (and allows notifications); the times are only suggestions until then.
@immutable
final class ReminderSettings {
  const new({
    required this.morningAt,
    required this.eveningAt,
    this.morningOn = false,
    this.eveningOn = false,
  });

  /// Early, because in Cavite the cool part of the day is the early morning.
  /// The evening one comes after a typical after-work ride. Our defaults.
  static final ReminderSettings defaults = ReminderSettings(
    morningAt: ClockTime(5, 30),
    eveningAt: ClockTime(19, 30),
  );

  final bool morningOn;
  final ClockTime morningAt;
  final bool eveningOn;
  final ClockTime eveningAt;

  bool isOn(ReminderKind kind) => switch (kind) {
    ReminderKind.morning => morningOn,
    ReminderKind.evening => eveningOn,
  };

  ClockTime timeOf(ReminderKind kind) => switch (kind) {
    ReminderKind.morning => morningAt,
    ReminderKind.evening => eveningAt,
  };

  bool get anyOn => morningOn || eveningOn;

  ReminderSettings copyWith({
    bool? morningOn,
    ClockTime? morningAt,
    bool? eveningOn,
    ClockTime? eveningAt,
  }) => ReminderSettings(
    morningOn: morningOn ?? this.morningOn,
    morningAt: morningAt ?? this.morningAt,
    eveningOn: eveningOn ?? this.eveningOn,
    eveningAt: eveningAt ?? this.eveningAt,
  );

  @override
  bool operator ==(Object other) =>
      other is ReminderSettings &&
      other.morningOn == morningOn &&
      other.morningAt == morningAt &&
      other.eveningOn == eveningOn &&
      other.eveningAt == eveningAt;

  @override
  int get hashCode => Object.hash(morningOn, morningAt, eveningOn, eveningAt);
}

/// One reminder to put on the phone.
@immutable
final class PlannedReminder {
  const new({required this.id, required this.kind, required this.at, this.day});

  /// Stable per kind and day offset, so rescheduling replaces rather than
  /// duplicates: see [reminderId].
  final int id;
  final ReminderKind kind;

  /// Local wall-clock time of the first (or only) firing.
  final DateTime at;

  /// The day this reminder is about, or null for the fallback that repeats
  /// every day at [at]'s time once the dated ones run out.
  final CalendarDay? day;

  bool get repeatsDaily => day == null;

  @override
  bool operator ==(Object other) =>
      other is PlannedReminder &&
      other.id == id &&
      other.kind == kind &&
      other.at == at &&
      other.day == day;

  @override
  int get hashCode => Object.hash(id, kind, at, day);

  @override
  String toString() =>
      'PlannedReminder($id, ${kind.name}, $at${repeatsDaily ? ', daily' : ''})';
}

/// How many days ahead get a reminder written for that day. A week matches
/// the forecast and the plan the app shows.
const reminderDaysAhead = 7;

/// The id of a reminder: 1 and 2 for the repeating fallbacks, 100 + offset
/// for dated morning reminders and 200 + offset for evening ones.
int reminderId(ReminderKind kind, {int? dayOffset}) {
  final base = switch (kind) {
    ReminderKind.morning => 1,
    ReminderKind.evening => 2,
  };
  if (dayOffset == null) return base;
  if (dayOffset < 0 || dayOffset >= reminderDaysAhead) {
    throw ArgumentError.value(dayOffset, 'dayOffset');
  }
  return base * 100 + dayOffset;
}

/// The reminders to put on the phone from [now].
///
/// Each switched-on reminder gets one dated reminder per day for
/// [reminderDaysAhead] days - today only if its time is still to come - so
/// the morning one can carry that day's session and weather. After those
/// run out, a plain reminder repeats every day, so a rider who does not open
/// the app for a week still gets reminded; the next time the app opens,
/// everything is planned again from fresh data.
///
/// [skip] leaves out a dated reminder, for example the morning reminder on
/// a day the plan says to see a doctor rather than ride. A skipped day gets
/// no reminder at all; the fallback does not fill in for it.
List<PlannedReminder> planReminders({
  required ReminderSettings settings,
  required DateTime now,
  bool Function(ReminderKind kind, CalendarDay day)? skip,
}) {
  final today = CalendarDay.of(now);
  final planned = <PlannedReminder>[];
  for (final kind in ReminderKind.values) {
    if (!settings.isOn(kind)) continue;
    final time = settings.timeOf(kind);
    for (var offset = 0; offset < reminderDaysAhead; offset++) {
      final day = today.addDays(offset);
      final at = time.on(day);
      if (!at.isAfter(now)) continue;
      if (skip?.call(kind, day) ?? false) continue;
      planned.add(
        PlannedReminder(
          id: reminderId(kind, dayOffset: offset),
          kind: kind,
          at: at,
          day: day,
        ),
      );
    }
    planned.add(
      PlannedReminder(
        id: reminderId(kind),
        kind: kind,
        at: time.on(today.addDays(reminderDaysAhead)),
      ),
    );
  }
  return planned;
}
