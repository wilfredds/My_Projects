import 'package:meta/meta.dart';

/// The things to do on race day, in the order they happen.
enum TimelineStep {
  wakeUp,
  preRaceMeal,
  leaveHome,
  arrive,
  registration,
  reconLaps,
  warmUpStart,
  warmUpEnd,
  finalBottleAndToilet,
  lineUp,
  raceStart,
}

@immutable
final class TimelineItem {
  const new(this.step, this.time);

  final TimelineStep step;
  final DateTime time;

  @override
  bool operator ==(Object other) =>
      other is TimelineItem && other.step == step && other.time == time;

  @override
  int get hashCode => Object.hash(step, time);

  @override
  String toString() =>
      '${step.name}@${time.hour.toString().padLeft(2, '0')}:'
      '${time.minute.toString().padLeft(2, '0')}';
}

/// Minutes before the start for each fixed step. Each is the middle of the
/// range given in the product spec (docs/SCIENCE.md, "Race-day timeline"):
/// meal 2-3 h before; arrive 60-90 min before; warm up 15-25 min, ending
/// 5-10 min before the start. They are coaching conventions, not study
/// results.
const mealMinutesBefore = 150;
const arriveMinutesBefore = 75;
const registrationMinutesBefore = 65;
const reconMinutesBefore = 50;
const warmUpStartMinutesBefore = 30;
const warmUpEndMinutesBefore = 10;
const lineUpMinutesBefore = 5;

/// Time to get up and ready before the first thing of the day.
const wakeUpLeadMinutes = 30;

/// Time to get out of the door once up, when leaving comes before eating.
const getReadyMinutes = 45;

/// Works backward from the start time to a schedule for the whole morning.
///
/// Everything is anchored to the gun: change the start time and every step
/// moves with it. A long drive pulls the wake-up earlier (the meal is then
/// eaten on the way); a race with no course preview drops the recon step.
List<TimelineItem> raceDayTimeline({
  required DateTime raceStart,
  int travelMinutes = 30,
  bool reconAllowed = true,
}) {
  if (travelMinutes < 0) {
    throw ArgumentError.value(travelMinutes, 'travelMinutes', 'is negative');
  }
  DateTime before(int minutes) =>
      raceStart.subtract(Duration(minutes: minutes));

  final leaveBefore = arriveMinutesBefore + travelMinutes;
  // Whichever comes first - eating or leaving - sets when to get up.
  final wakeBefore = [
    mealMinutesBefore + wakeUpLeadMinutes,
    leaveBefore + getReadyMinutes,
  ].reduce((a, b) => a > b ? a : b);

  final items = [
    TimelineItem(TimelineStep.wakeUp, before(wakeBefore)),
    TimelineItem(TimelineStep.preRaceMeal, before(mealMinutesBefore)),
    TimelineItem(TimelineStep.leaveHome, before(leaveBefore)),
    TimelineItem(TimelineStep.arrive, before(arriveMinutesBefore)),
    TimelineItem(TimelineStep.registration, before(registrationMinutesBefore)),
    if (reconAllowed)
      TimelineItem(TimelineStep.reconLaps, before(reconMinutesBefore)),
    TimelineItem(TimelineStep.warmUpStart, before(warmUpStartMinutesBefore)),
    TimelineItem(TimelineStep.warmUpEnd, before(warmUpEndMinutesBefore)),
    TimelineItem(
      TimelineStep.finalBottleAndToilet,
      before(warmUpEndMinutesBefore),
    ),
    TimelineItem(TimelineStep.lineUp, before(lineUpMinutesBefore)),
    TimelineItem(TimelineStep.raceStart, raceStart),
  ];
  // A stable sort keeps the listed order for steps at the same minute.
  final indexed = [for (var i = 0; i < items.length; i++) (i, items[i])]
    ..sort((a, b) {
      final byTime = a.$2.time.compareTo(b.$2.time);
      return byTime != 0 ? byTime : a.$1.compareTo(b.$1);
    });
  return [for (final (_, item) in indexed) item];
}
