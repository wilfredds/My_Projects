import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/core/science/fuelling.dart';
import 'package:ride_doctor/core/science/hydration.dart';

void main() {
  group('carbohydrateDuringRide', () {
    CarbGuidance at(int minutes) =>
        carbohydrateDuringRide(rideMinutes: minutes).value;

    test('none under an hour', () {
      expect(
        at(45),
        const CarbGuidance(minGramsPerHour: 0, maxGramsPerHour: 0),
      );
      expect(at(59).needed, isFalse);
      expect(carbohydrateDuringRide(rideMinutes: 45).improvements, isEmpty);
    });

    test('30-60 g/h from one hour to two and a half', () {
      for (final minutes in [60, 90, 150]) {
        expect(
          at(minutes),
          const CarbGuidance(minGramsPerHour: 30, maxGramsPerHour: 60),
        );
      }
    });

    test('60-90 g/h beyond two and a half hours', () {
      for (final minutes in [151, 240, 360]) {
        expect(
          at(minutes),
          const CarbGuidance(minGramsPerHour: 60, maxGramsPerHour: 90),
        );
      }
    });

    test('is explained and points to practising', () {
      final result = carbohydrateDuringRide(rideMinutes: 120);
      expect(result.formula, Formula.carbohydrateByDuration);
      expect(result.confidence, Confidence.estimated);
      expect(result.inputs, const [Input(Quantity.durationMinutes, 120)]);
      expect(result.improvements, const [Improvement.practiseFuelling]);
    });

    test('rejects impossible lengths', () {
      expect(() => at(0), throwsArgumentError);
      expect(() => at(1441), throwsArgumentError);
    });

    test('CarbGuidance has value equality', () {
      expect(
        const CarbGuidance(minGramsPerHour: 30, maxGramsPerHour: 60).hashCode,
        const CarbGuidance(minGramsPerHour: 30, maxGramsPerHour: 60).hashCode,
      );
    });
  });

  group('sweatRate', () {
    test('(before - after + drink - urine) / hours', () {
      const test = SweatTest(
        weightBeforeKg: 60,
        weightAfterKg: 59,
        drankLitres: 0.75,
        minutes: 90,
      );
      final result = sweatRate(test);
      // 1.0 kg + 0.75 L = 1.75 L over 1.5 h.
      expect(result.value, closeTo(1.1667, 0.0001));
      expect(result.confidence, Confidence.measured);
      expect(result.formula, Formula.sweatRate);
      expect(result.inputs, hasLength(5));
    });

    test('urine is subtracted', () {
      const test = SweatTest(
        weightBeforeKg: 60,
        weightAfterKg: 58.5,
        drankLitres: 0.5,
        urineLitres: 0.2,
        minutes: 60,
      );
      expect(sweatRate(test).value, closeTo(1.8, 1e-9));
    });

    test('numbers that do not add up give zero, not a negative rate', () {
      const test = SweatTest(
        weightBeforeKg: 60,
        weightAfterKg: 60,
        drankLitres: 0,
        urineLitres: 0.5,
        minutes: 60,
      );
      expect(sweatRate(test).value, 0);
    });

    test('rejects typos and impossible values', () {
      SweatTest t({
        double before = 60,
        double after = 59,
        double drank = 0.5,
        double urine = 0,
        int minutes = 60,
      }) => SweatTest(
        weightBeforeKg: before,
        weightAfterKg: after,
        drankLitres: drank,
        urineLitres: urine,
        minutes: minutes,
      );
      for (final bad in [
        t(before: 20),
        t(after: 260),
        t(before: 66, after: 60),
        t(drank: 11),
        t(urine: 6),
        t(drank: -1),
        t(minutes: 10),
        t(minutes: 700),
      ]) {
        expect(() => sweatRate(bad), throwsArgumentError);
        expect(() => drinkingVerdict(bad), throwsArgumentError);
      }
    });
  });

  group('drinkingVerdict', () {
    DrinkingVerdict verdict(double before, double after) => drinkingVerdict(
      SweatTest(
        weightBeforeKg: before,
        weightAfterKg: after,
        drankLitres: 0.5,
        minutes: 90,
      ),
    );

    test('up to 2% loss is about right, including exactly 2%', () {
      expect(verdict(60, 59), DrinkingVerdict.aboutRight);
      expect(verdict(60, 58.8), DrinkingVerdict.aboutRight);
      expect(verdict(60, 60), DrinkingVerdict.aboutRight);
    });

    test('more than 2% loss: drank too little', () {
      expect(verdict(60, 58.7), DrinkingVerdict.drankTooLittle);
    });

    test('weighing more after the ride: drank too much', () {
      expect(verdict(60, 60.3), DrinkingVerdict.drankTooMuch);
    });

    test('massChangePercent', () {
      expect(
        const SweatTest(
          weightBeforeKg: 60,
          weightAfterKg: 59.4,
          drankLitres: 0,
          minutes: 60,
        ).massChangePercent,
        closeTo(1, 1e-9),
      );
    });
  });
}
