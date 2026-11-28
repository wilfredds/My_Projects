import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/features/race_prep/domain/countdown.dart';

void main() {
  final raceStart = DateTime(2027, 3, 14, 6, 30);

  CountdownMode modeAt(Duration before) =>
      countdownMode(now: raceStart.subtract(before), raceStart: raceStart);

  group('countdownMode', () {
    test('8 weeks or more is a long build', () {
      expect(modeAt(const Duration(days: 56)), CountdownMode.longBuild);
      expect(modeAt(const Duration(days: 120)), CountdownMode.longBuild);
    });

    test('2 to under 8 weeks is a compressed build', () {
      expect(
        modeAt(const Duration(days: 55, hours: 23)),
        CountdownMode.compressedBuild,
      );
      expect(modeAt(const Duration(days: 14)), CountdownMode.compressedBuild);
    });

    test('2 to under 14 days is race week', () {
      expect(
        modeAt(const Duration(days: 13, hours: 23)),
        CountdownMode.raceWeek,
      );
      expect(modeAt(const Duration(hours: 48)), CountdownMode.raceWeek);
    });

    test('under 48 hours is race day, right up to the gun', () {
      expect(
        modeAt(const Duration(hours: 47, minutes: 59)),
        CountdownMode.raceDay,
      );
      expect(modeAt(const Duration(hours: 9)), CountdownMode.raceDay);
      expect(modeAt(Duration.zero), CountdownMode.raceDay);
    });

    test('after the start the race is over', () {
      expect(modeAt(const Duration(seconds: -1)), CountdownMode.raceOver);
      expect(modeAt(const Duration(days: -30)), CountdownMode.raceOver);
    });
  });

  group('daysUntil counts dates, not 24-hour blocks', () {
    test('the evening before a morning race is 1 day', () {
      expect(
        daysUntil(now: DateTime(2027, 3, 13, 21, 30), raceStart: raceStart),
        1,
      );
    });

    test('race morning is 0', () {
      expect(daysUntil(now: DateTime(2027, 3, 14, 4), raceStart: raceStart), 0);
    });

    test('the day after is -1', () {
      expect(
        daysUntil(now: DateTime(2027, 3, 15, 8), raceStart: raceStart),
        -1,
      );
    });

    test('is not thrown off by a month boundary', () {
      expect(
        daysUntil(now: DateTime(2027, 2, 27, 12), raceStart: raceStart),
        15,
      );
    });
  });

  group('planPhases', () {
    List<PhaseBlock> phasesAt(DateTime now) =>
        planPhases(now: now, raceStart: raceStart);

    test('a long build is base, 4 weeks of build, then a 2-week taper', () {
      // 12 weeks out.
      final blocks = phasesAt(DateTime(2026, 12, 20, 9));

      expect(blocks.map((b) => b.phase), [
        PlanPhase.base,
        PlanPhase.build,
        PlanPhase.taper,
      ]);
      expect(blocks[2].days, longTaperDays);
      expect(blocks[1].days, longBuildBlockDays);
      expect(blocks[0].firstDay, DateTime.utc(2026, 12, 20));
      expect(blocks[2].lastDay, DateTime.utc(2027, 3, 13));
    });

    test('a compressed build is build then a 1-week taper', () {
      // 4 weeks out.
      final blocks = phasesAt(DateTime(2027, 2, 14, 9));

      expect(blocks.map((b) => b.phase), [PlanPhase.build, PlanPhase.taper]);
      expect(blocks[1].days, shortTaperDays);
      expect(blocks[1].firstDay, DateTime.utc(2027, 3, 7));
      expect(blocks[1].lastDay, DateTime.utc(2027, 3, 13));
      expect(blocks[0].lastDay, DateTime.utc(2027, 3, 6));
    });

    test('blocks are contiguous, never overlap and cover every day', () {
      for (final daysOut in [14, 20, 41, 55, 56, 57, 70, 120]) {
        final now = raceStart.subtract(Duration(days: daysOut, hours: 1));
        final blocks = phasesAt(now);
        expect(blocks, isNotEmpty, reason: '$daysOut days out');
        for (var i = 0; i + 1 < blocks.length; i++) {
          expect(
            blocks[i + 1].firstDay.difference(blocks[i].lastDay).inDays,
            1,
            reason: '$daysOut days out: $blocks',
          );
        }
        for (final block in blocks) {
          expect(block.days, greaterThan(0), reason: '$daysOut: $blocks');
        }
        expect(
          blocks.first.firstDay,
          DateTime.utc(now.year, now.month, now.day),
        );
        expect(blocks.last.lastDay, DateTime.utc(2027, 3, 13));
      }
    });

    test('the taper length follows the notice the rider had', () {
      DateTime addedDaysBefore(int days) =>
          DateTime(2027, 3, 14 - days, 20); // an evening, any time works
      expect(
        taperDaysFor(addedAt: addedDaysBefore(70), raceStart: raceStart),
        longTaperDays,
      );
      expect(
        taperDaysFor(addedAt: addedDaysBefore(56), raceStart: raceStart),
        longTaperDays,
      );
      expect(
        taperDaysFor(addedAt: addedDaysBefore(55), raceStart: raceStart),
        shortTaperDays,
      );
      expect(
        taperDaysFor(addedAt: addedDaysBefore(14), raceStart: raceStart),
        shortTaperDays,
      );
      expect(
        taperDaysFor(addedAt: addedDaysBefore(13), raceStart: raceStart),
        0,
      );
    });

    test('a race added 10 weeks out keeps its 2-week taper as it nears', () {
      final addedAt = DateTime(2027, 1, 3, 20); // 70 days out
      List<PhaseBlock> at(DateTime now) =>
          planPhases(now: now, raceStart: raceStart, addedAt: addedAt);

      // 55 days out: today this would be a 1-week taper without the notice.
      final fiftyFive = at(DateTime(2027, 1, 18, 9));
      expect(fiftyFive.map((b) => b.phase), [PlanPhase.build, PlanPhase.taper]);
      expect(fiftyFive.last.days, longTaperDays);
      expect(
        planPhases(
          now: DateTime(2027, 1, 18, 9),
          raceStart: raceStart,
        ).last.days,
        shortTaperDays,
      );

      // 20 days out: 6 days of build, then the same 14-day taper.
      final twenty = at(DateTime(2027, 2, 22, 9));
      expect(twenty.first.days, 6);
      expect(twenty.last.firstDay, DateTime.utc(2027, 2, 28));
      expect(twenty.last.days, longTaperDays);

      // Exactly 14 days out: it is all taper, starting today.
      final fourteen = at(DateTime(2027, 2, 28, 5));
      expect(fourteen.map((b) => b.phase), [PlanPhase.taper]);
      expect(fourteen.single.firstDay, DateTime.utc(2027, 2, 28));
      expect(fourteen.single.days, longTaperDays);
    });

    test('a race added in race week falls back to the time left', () {
      // Notice of 10 days means no taper by notice; if the clock is then
      // moved back weeks, the time left decides instead.
      final blocks = planPhases(
        now: DateTime(2027, 2, 1, 9),
        raceStart: raceStart,
        addedAt: DateTime(2027, 3, 4, 9),
      );
      expect(blocks.last.days, shortTaperDays);
    });

    test('inside two weeks there are no phases', () {
      expect(phasesAt(DateTime(2027, 3, 5)), isEmpty);
      expect(phasesAt(DateTime(2027, 3, 14, 5)), isEmpty);
      expect(phasesAt(DateTime(2027, 3, 20)), isEmpty);
    });

    test('PhaseBlock describes itself', () {
      expect(
        PhaseBlock(
          PlanPhase.taper,
          DateTime.utc(2027, 3, 7),
          DateTime.utc(2027, 3, 13),
        ).toString(),
        'taper 2027-03-07..2027-03-13',
      );
    });
  });
}
