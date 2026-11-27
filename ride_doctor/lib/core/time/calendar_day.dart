import 'package:meta/meta.dart';

/// A date on the calendar - "Thursday the 27th" - with no time of day and no
/// time zone.
///
/// Training plans, check-ins and weekly totals all work in whole days. Doing
/// that arithmetic with `DateTime` invites off-by-one bugs: adding
/// `Duration(days: 1)` to a local midnight lands at 23:00 or 01:00 on a
/// daylight-saving change, and comparing a 05:30 ride with a 20:00 check-in
/// is a question about dates, not instants. This type does the arithmetic on
/// UTC midnights internally, where every day is exactly 24 hours, and only
/// ever exposes year, month and day.
@immutable
final class CalendarDay implements Comparable<CalendarDay> {
  /// Out-of-range parts roll over the way `DateTime` does:
  /// `CalendarDay(2027, 1, 32)` is the 1st of February.
  new(int year, int month, int day) : _utc = DateTime.utc(year, month, day);

  /// The calendar day a moment falls on, in that moment's own time zone.
  /// For `DateTime.now()` that is the phone's local date.
  new of(DateTime moment)
    : _utc = DateTime.utc(moment.year, moment.month, moment.day);

  /// Reads the form written by [toIso]: "2027-03-14".
  static CalendarDay parse(String text) {
    final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(text.trim());
    if (match == null) {
      throw FormatException('expected YYYY-MM-DD', text);
    }
    final year = int.parse(match.group(1)!);
    final month = int.parse(match.group(2)!);
    final day = int.parse(match.group(3)!);
    final parsed = CalendarDay(year, month, day);
    // Reject dates that only exist by rolling over, such as 2027-02-30.
    if (parsed.year != year || parsed.month != month || parsed.day != day) {
      throw FormatException('not a real date', text);
    }
    return parsed;
  }

  /// Midnight UTC of this date. Used for arithmetic only; never shown.
  final DateTime _utc;

  int get year => _utc.year;
  int get month => _utc.month;
  int get day => _utc.day;

  /// 1 = Monday ... 7 = Sunday, as `DateTime.monday` ... `DateTime.sunday`.
  int get weekday => _utc.weekday;

  CalendarDay addDays(int days) => CalendarDay(year, month, day + days);

  /// Whole days from this date to [other]: positive when [other] is later.
  int daysUntil(CalendarDay other) => other._utc.difference(_utc).inDays;

  /// The Monday on or before this date. Weeks run Monday to Sunday, the
  /// ISO 8601 convention, which is also what Philippine calendars use.
  CalendarDay get weekStart => addDays(DateTime.monday - weekday);

  /// The local wall-clock moment at [hour]:[minute] on this date.
  DateTime at(int hour, [int minute = 0]) =>
      DateTime(year, month, day, hour, minute);

  bool isBefore(CalendarDay other) => _utc.isBefore(other._utc);
  bool isAfter(CalendarDay other) => _utc.isAfter(other._utc);

  /// "2027-03-14". Sorts in date order as plain text, which is why the
  /// database stores days this way.
  String toIso() =>
      '${year.toString().padLeft(4, '0')}-'
      '${month.toString().padLeft(2, '0')}-'
      '${day.toString().padLeft(2, '0')}';

  @override
  int compareTo(CalendarDay other) => _utc.compareTo(other._utc);

  @override
  bool operator ==(Object other) => other is CalendarDay && other._utc == _utc;

  @override
  int get hashCode => _utc.hashCode;

  @override
  String toString() => toIso();
}
