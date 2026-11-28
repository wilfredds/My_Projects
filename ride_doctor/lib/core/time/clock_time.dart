import 'package:meta/meta.dart';
import 'package:ride_doctor/core/time/calendar_day.dart';

/// A time of day on the wall clock - "05:30" - with no date and no time zone.
///
/// Reminder times and usual ride times are stored this way: "every day at
/// 05:30, wherever the phone is". Joining one to a [CalendarDay] gives the
/// moment ([on]).
@immutable
final class ClockTime implements Comparable<ClockTime> {
  /// Throws [ArgumentError] outside 00:00-23:59.
  new(this.hour, [this.minute = 0]) {
    if (hour < 0 || hour > 23) {
      throw ArgumentError.value(hour, 'hour', 'must be 0-23');
    }
    if (minute < 0 || minute > 59) {
      throw ArgumentError.value(minute, 'minute', 'must be 0-59');
    }
  }

  /// Reads the form written by [toString]: "05:30".
  factory parse(String text) {
    final match = RegExp(r'^(\d{2}):(\d{2})$').firstMatch(text.trim());
    if (match == null) throw FormatException('expected HH:MM', text);
    final hour = int.parse(match.group(1)!);
    final minute = int.parse(match.group(2)!);
    if (hour > 23 || minute > 59) throw FormatException('not a time', text);
    return ClockTime(hour, minute);
  }

  final int hour;
  final int minute;

  /// Minutes since midnight: 05:30 is 330.
  int get minutesOfDay => hour * 60 + minute;

  /// The local moment at this time on [day].
  DateTime on(CalendarDay day) => day.at(hour, minute);

  @override
  int compareTo(ClockTime other) => minutesOfDay.compareTo(other.minutesOfDay);

  @override
  bool operator ==(Object other) =>
      other is ClockTime && other.hour == hour && other.minute == minute;

  @override
  int get hashCode => Object.hash(hour, minute);

  /// "05:30". Zero-padded, so it sorts as text and is what the database
  /// stores.
  @override
  String toString() =>
      '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
}
