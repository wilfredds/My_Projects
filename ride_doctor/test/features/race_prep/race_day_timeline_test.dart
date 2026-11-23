import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/features/race_prep/domain/race_checklist.dart';
import 'package:ride_doctor/features/race_prep/domain/race_day_timeline.dart';
import 'package:ride_doctor/features/race_prep/domain/race_debrief.dart';
import 'package:ride_doctor/features/race_prep/domain/race_event.dart';
import 'package:ride_doctor/features/race_prep/domain/skill_cards.dart';

void main() {
  final start = DateTime(2027, 3, 14, 8);

  DateTime timeOf(List<TimelineItem> items, TimelineStep step) =>
      items.firstWhere((item) => item.step == step).time;

  group('raceDayTimeline', () {
    test('an 8:00 start with a 30-minute drive', () {
      expect(raceDayTimeline(raceStart: start).map((item) => '$item'), [
        'wakeUp@05:00',
        'preRaceMeal@05:30',
        'leaveHome@06:15',
        'arrive@06:45',
        'registration@06:55',
        'reconLaps@07:10',
        'warmUpStart@07:30',
        'warmUpEnd@07:50',
        'finalBottleAndToilet@07:50',
        'lineUp@07:55',
        'raceStart@08:00',
      ]);
    });

    test('respects the ranges in the spec', () {
      final items = raceDayTimeline(raceStart: start);
      Duration before(TimelineStep step) =>
          start.difference(timeOf(items, step));

      // Meal 2-3 h before; arrival 60-90 min before.
      expect(
        before(TimelineStep.preRaceMeal).inMinutes,
        inInclusiveRange(120, 180),
      );
      expect(before(TimelineStep.arrive).inMinutes, inInclusiveRange(60, 90));
      // Warm-up 15-25 min, ending 5-10 min before the start.
      final warmUp = timeOf(
        items,
        TimelineStep.warmUpEnd,
      ).difference(timeOf(items, TimelineStep.warmUpStart));
      expect(warmUp.inMinutes, inInclusiveRange(15, 25));
      expect(before(TimelineStep.warmUpEnd).inMinutes, inInclusiveRange(5, 10));
    });

    test('is always in time order and ends at the start', () {
      for (final travel in [0, 30, 90, 180]) {
        final items = raceDayTimeline(raceStart: start, travelMinutes: travel);
        for (var i = 0; i + 1 < items.length; i++) {
          expect(
            items[i].time.isAfter(items[i + 1].time),
            isFalse,
            reason: 'travel $travel: $items',
          );
        }
        expect(items.last, TimelineItem(TimelineStep.raceStart, start));
        expect(items.first.step, TimelineStep.wakeUp);
      }
    });

    test('a long drive means an earlier wake-up and eating on the way', () {
      final items = raceDayTimeline(raceStart: start, travelMinutes: 120);

      // Leave 75 + 120 = 195 min before -> 04:45; up 45 min earlier.
      expect(
        timeOf(items, TimelineStep.leaveHome),
        DateTime(2027, 3, 14, 4, 45),
      );
      expect(timeOf(items, TimelineStep.wakeUp), DateTime(2027, 3, 14, 4));
      expect(
        timeOf(
          items,
          TimelineStep.preRaceMeal,
        ).isAfter(timeOf(items, TimelineStep.leaveHome)),
        isTrue,
      );
    });

    test('an early start pushes the morning into the previous night', () {
      final items = raceDayTimeline(raceStart: DateTime(2027, 3, 14, 2));
      expect(timeOf(items, TimelineStep.wakeUp), DateTime(2027, 3, 13, 23));
    });

    test('no course preview, no recon step', () {
      final items = raceDayTimeline(raceStart: start, reconAllowed: false);
      expect(
        items.map((item) => item.step),
        isNot(contains(TimelineStep.reconLaps)),
      );
      expect(items, hasLength(10));
    });

    test('moving the start moves every step by the same amount', () {
      final early = raceDayTimeline(raceStart: start);
      final late = raceDayTimeline(
        raceStart: start.add(const Duration(hours: 3)),
      );
      for (var i = 0; i < early.length; i++) {
        expect(late[i].step, early[i].step);
        expect(late[i].time.difference(early[i].time).inHours, 3);
      }
    });

    test('rejects a negative travel time', () {
      expect(
        () => raceDayTimeline(raceStart: start, travelMinutes: -5),
        throwsArgumentError,
      );
    });

    test('TimelineItem has value equality', () {
      expect(
        TimelineItem(TimelineStep.arrive, start).hashCode,
        TimelineItem(TimelineStep.arrive, start).hashCode,
      );
    });
  });

  group('checklist', () {
    test('every group has items, and every item is in exactly one group', () {
      var total = 0;
      for (final group in ChecklistGroup.values) {
        final items = ChecklistItem.inGroup(group);
        expect(items, isNotEmpty, reason: group.name);
        total += items.length;
      }
      expect(total, ChecklistItem.values.length);
    });

    test('covers what the spec lists for the bike', () {
      expect(ChecklistItem.inGroup(ChecklistGroup.bike), [
        ChecklistItem.tyrePressure,
        ChecklistItem.wheelsSecure,
        ChecklistItem.boltsTight,
        ChecklistItem.brakesWork,
        ChecklistItem.gearsShift,
        ChecklistItem.barEndPlugs,
      ]);
    });
  });

  group('skill cards', () {
    test('every race type has cards, with no repeats', () {
      for (final type in RaceType.values) {
        final cards = skillCardsFor(type);
        expect(cards, isNotEmpty, reason: type.name);
        expect(cards.toSet(), hasLength(cards.length), reason: type.name);
      }
    });

    test('every card is used by at least one race type', () {
      final used = {for (final type in RaceType.values) ...skillCardsFor(type)};
      expect(used, SkillCard.values.toSet());
    });

    test('a criterium leads with line-holding, cornering and shifting', () {
      expect(skillCardsFor(RaceType.criterium).take(3), [
        SkillCard.holdYourLine,
        SkillCard.cornering,
        SkillCard.shiftBeforeCorners,
      ]);
    });
  });

  group('RaceDebrief', () {
    RaceDebrief debrief(Set<RaceSymptom> symptoms) => RaceDebrief(
      raceId: 'r1',
      finished: true,
      droppedWhen: DroppedWhen.midRace,
      recordedAt: start,
      symptoms: symptoms,
    );

    test('dizziness is a red flag', () {
      expect(debrief({RaceSymptom.dizziness}).hasRedFlag, isTrue);
      expect(
        debrief({RaceSymptom.cramps, RaceSymptom.dizziness}).hasRedFlag,
        isTrue,
      );
    });

    test('cramps alone are not', () {
      expect(debrief({RaceSymptom.cramps}).hasRedFlag, isFalse);
      expect(debrief({}).hasRedFlag, isFalse);
    });
  });
}
