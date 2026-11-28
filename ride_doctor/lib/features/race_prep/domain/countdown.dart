import 'package:meta/meta.dart';

/// What kind of preparation fits the time left before a race
/// (PROMPT.md section 8, Phase 2). The mode picks itself from the calendar.
enum CountdownMode {
  /// 8 weeks or more: base, then build, then taper.
  longBuild,

  /// 2 to 7 weeks: a compressed build, then a short taper.
  compressedBuild,

  /// 2 to 13 days: openers, sleep, skills review, logistics.
  raceWeek,

  /// Under 48 hours: checklist, timeline, warm-up, tactics.
  raceDay,

  /// The start has passed: time for the debrief.
  raceOver,
}

const _raceDayWindow = Duration(hours: 48);
const _raceWeekDays = 14;
const _longBuildDays = 56;

/// The mode for a race starting at [raceStart], seen from [now].
///
/// The boundaries are exact: 48 hours out is still race week, one second
/// later is race day; 14 full days out is a compressed build, 56 is a long
/// build.
CountdownMode countdownMode({
  required DateTime now,
  required DateTime raceStart,
}) {
  final remaining = raceStart.difference(now);
  if (remaining.isNegative) return CountdownMode.raceOver;
  if (remaining < _raceDayWindow) return CountdownMode.raceDay;
  if (remaining.inDays < _raceWeekDays) return CountdownMode.raceWeek;
  if (remaining.inDays < _longBuildDays) return CountdownMode.compressedBuild;
  return CountdownMode.longBuild;
}

/// Calendar days until the race: 0 on race day, 1 the day before, negative
/// once it has passed. Counts dates, not 24-hour blocks, because "tomorrow"
/// means the next date even when the start is only 9 hours away.
int daysUntil({required DateTime now, required DateTime raceStart}) {
  final today = DateTime.utc(now.year, now.month, now.day);
  final raceDay = DateTime.utc(raceStart.year, raceStart.month, raceStart.day);
  return raceDay.difference(today).inDays;
}

enum PlanPhase { base, build, taper }

/// One block of the preparation, as whole dates (inclusive).
@immutable
final class PhaseBlock {
  const new(this.phase, this.firstDay, this.lastDay);

  final PlanPhase phase;
  final DateTime firstDay;
  final DateTime lastDay;

  int get days => lastDay.difference(firstDay).inDays + 1;

  @override
  String toString() =>
      '${phase.name} ${firstDay.toIso8601String().substring(0, 10)}'
      '..${lastDay.toIso8601String().substring(0, 10)}';
}

/// Taper lengths in days. A two-week taper is what the taper meta-analysis
/// found most effective (docs/SCIENCE.md 7.13); with under 8 weeks in hand we
/// shorten it to one week so there is still time left to build.
const longTaperDays = 14;
const shortTaperDays = 7;

/// Length of the build block before the taper in a long preparation. Our own
/// planning convention, not from a source.
const longBuildBlockDays = 28;

/// How long the taper before a race is, from the notice the rider had: a
/// race added 8 or more weeks ahead gets the two-week taper, one added 2 to
/// under 8 weeks ahead gets one week, and a later one none (it starts in
/// race week).
///
/// Taken from when the race was added, not from today: otherwise a race
/// 56 days away would have a 14-day taper and, one day later, a 7-day one -
/// the plan would change shape under the rider for no reason.
int taperDaysFor({required DateTime addedAt, required DateTime raceStart}) {
  // The database keeps the moment in UTC; the date that counts is the one
  // on the rider's calendar when they added it.
  final notice = daysUntil(now: addedAt.toLocal(), raceStart: raceStart);
  if (notice >= _longBuildDays) return longTaperDays;
  if (notice >= _raceWeekDays) return shortTaperDays;
  return 0;
}

/// Splits the days from [now] to race day into base, build and taper.
///
/// Only the two "build" modes have phases; nearer the race the answer is an
/// empty list. Blocks are returned in order and never overlap, and the taper
/// always ends the day before the race.
///
/// With [addedAt], the taper's length follows the notice the rider had
/// ([taperDaysFor]); without it, the time left today decides, as before a
/// race is saved.
List<PhaseBlock> planPhases({
  required DateTime now,
  required DateTime raceStart,
  DateTime? addedAt,
}) {
  final mode = countdownMode(now: now, raceStart: raceStart);
  if (mode != CountdownMode.longBuild &&
      mode != CountdownMode.compressedBuild) {
    return const [];
  }
  final today = DateTime.utc(now.year, now.month, now.day);
  final dayBeforeRace = DateTime.utc(
    raceStart.year,
    raceStart.month,
    raceStart.day - 1,
  );
  DateTime back(DateTime from, int days) =>
      DateTime.utc(from.year, from.month, from.day - days);

  final byNotice = addedAt == null
      ? null
      : taperDaysFor(addedAt: addedAt, raceStart: raceStart);
  // A race added in race week and somehow still weeks away (the clock moved)
  // falls back to the time left.
  final taperDays = byNotice != null && byNotice > 0
      ? byNotice
      : mode == CountdownMode.longBuild
      ? longTaperDays
      : shortTaperDays;
  final taperStart = back(dayBeforeRace, taperDays - 1);
  final buildEnd = back(taperStart, 1);
  // The taper never starts before today: with exactly 14 days left and a
  // 14-day taper, the whole preparation is taper.
  if (buildEnd.isBefore(today)) {
    return [PhaseBlock(PlanPhase.taper, today, dayBeforeRace)];
  }
  final taper = PhaseBlock(PlanPhase.taper, taperStart, dayBeforeRace);

  if (mode == CountdownMode.compressedBuild) {
    return [PhaseBlock(PlanPhase.build, today, buildEnd), taper];
  }
  final buildStart = back(buildEnd, longBuildBlockDays - 1);
  return [
    PhaseBlock(PlanPhase.base, today, back(buildStart, 1)),
    PhaseBlock(PlanPhase.build, buildStart, buildEnd),
    taper,
  ];
}
