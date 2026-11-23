import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/science/bike_fit.dart';
import 'package:ride_doctor/core/science/climb.dart';
import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/constants.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/core/science/gearing.dart';

void main() {
  group('airDensity', () {
    test('standard atmosphere: 15 C at sea level is 1.225 kg/m^3', () {
      expect(airDensity(temperatureC: 15), closeTo(1.2250, 0.0001));
    });

    test('hot air is thinner: 30 C is 1.164 kg/m^3', () {
      expect(airDensity(temperatureC: 30), closeTo(1.1644, 0.0001));
    });

    test('lower pressure (altitude) is thinner', () {
      expect(
        airDensity(temperatureC: 15, pressurePa: 90000),
        lessThan(airDensity(temperatureC: 15)),
      );
    });
  });

  group('powerRequiredW', () {
    // Reference values worked independently from the equation.
    test('80 kg at 3 m/s up 5% needs 139.3 W', () {
      expect(
        powerRequiredW(
          speedMs: 3,
          conditions: const ClimbConditions(totalMassKg: 80, gradePercent: 5),
        ),
        closeTo(139.25, 0.01),
      );
    });

    test('80 kg at 10 m/s on the flat needs 261.4 W', () {
      expect(
        powerRequiredW(
          speedMs: 10,
          conditions: const ClimbConditions(totalMassKg: 80, gradePercent: 0),
        ),
        closeTo(261.44, 0.01),
      );
    });

    test('80 kg at 2 m/s up 10% needs 170.8 W', () {
      expect(
        powerRequiredW(
          speedMs: 2,
          conditions: const ClimbConditions(totalMassKg: 80, gradePercent: 10),
        ),
        closeTo(170.77, 0.01),
      );
    });

    test('standing still needs no power', () {
      expect(
        powerRequiredW(
          speedMs: 0,
          conditions: const ClimbConditions(totalMassKg: 80, gradePercent: 8),
        ),
        0,
      );
    });
  });

  group('speedForPowerMs', () {
    test('reference solutions', () {
      // (power W, grade %, expected km/h) solved independently.
      for (final (power, grade, kmh) in [
        (150.0, 5.0, 11.561),
        (200.0, 0.0, 32.555),
        (150.0, 8.0, 7.763),
        (120.0, 10.0, 5.086),
      ]) {
        final speed = speedForPowerMs(
          powerW: power,
          conditions: ClimbConditions(totalMassKg: 80, gradePercent: grade),
        );
        expect(speed * 3.6, closeTo(kmh, 0.001), reason: '$power W at $grade%');
      }
    });

    test('is the exact inverse of powerRequiredW', () {
      for (final grade in [0.0, 2.0, 6.0, 12.0, 20.0]) {
        for (final power in [50.0, 150.0, 300.0, 900.0]) {
          final conditions = ClimbConditions(
            totalMassKg: 75,
            gradePercent: grade,
          );
          final speed = speedForPowerMs(powerW: power, conditions: conditions);
          expect(
            powerRequiredW(speedMs: speed, conditions: conditions),
            closeTo(power, 1e-6),
          );
        }
      }
    });

    test('more power is faster; steeper and heavier are slower', () {
      double speed({double power = 150, double grade = 6, double mass = 80}) =>
          speedForPowerMs(
            powerW: power,
            conditions: ClimbConditions(totalMassKg: mass, gradePercent: grade),
          );
      expect(speed(power: 200), greaterThan(speed()));
      expect(speed(grade: 9), lessThan(speed()));
      expect(speed(mass: 95), lessThan(speed()));
    });

    test('rejects zero or negative power', () {
      expect(
        () => speedForPowerMs(
          powerW: 0,
          conditions: const ClimbConditions(totalMassKg: 80, gradePercent: 5),
        ),
        throwsArgumentError,
      );
    });
  });

  group('climbingPowerW', () {
    test('with FTP: a fraction of it, Estimated', () {
      final steady = climbingPowerW(
        effort: Effort.steady,
        riderMassKg: 65,
        ftpWatts: 200,
      );
      expect(steady.value, closeTo(160, 1e-9));
      expect(steady.confidence, Confidence.estimated);
      expect(
        climbingPowerW(
          effort: Effort.easy,
          riderMassKg: 65,
          ftpWatts: 200,
        ).value,
        closeTo(130, 1e-9),
      );
      expect(
        climbingPowerW(
          effort: Effort.hard,
          riderMassKg: 65,
          ftpWatts: 200,
        ).value,
        closeTo(190, 1e-9),
      );
    });

    test('without FTP: default W/kg of body mass, Rough', () {
      final steady = climbingPowerW(effort: Effort.steady, riderMassKg: 65);
      expect(steady.value, closeTo(130, 1e-9));
      expect(steady.confidence, Confidence.rough);
      expect(steady.improvements, contains(Improvement.doFtpTest));
      expect(
        climbingPowerW(effort: Effort.easy, riderMassKg: 65).value,
        lessThan(steady.value),
      );
      expect(
        climbingPowerW(effort: Effort.hard, riderMassKg: 65).value,
        greaterThan(steady.value),
      );
    });
  });

  group('gearingForSpeed', () {
    const circumference = 2111.15;

    ClimbGearing at(double kmh, {List<int> rings = const [34, 50]}) =>
        gearingForSpeed(
          speedKmh: kmh,
          powerW: 150,
          chainrings: rings,
          cogs: const [11, 13, 15, 17, 19, 21, 24, 27, 30, 34],
          circumferenceMm: circumference,
        );

    test('lists every gear, easiest first', () {
      final result = at(12);
      expect(result.options, hasLength(20));
      expect(result.options.first.gear, const Gear(chainring: 34, cog: 34));
    });

    test('recommends the gear nearest 80 rpm', () {
      final result = at(12);
      for (final option in result.options) {
        expect(
          (result.recommended.cadenceRpm - 80).abs(),
          lessThanOrEqualTo((option.cadenceRpm - 80).abs()),
        );
      }
      expect(result.recommended.cadenceRpm, inInclusiveRange(70, 90));
      expect(result.willGrind, isFalse);
      expect(result.cogForComfort, isNull);
      expect(result.chainringForComfort, isNull);
    });

    test('at 8 km/h the easiest gear spins 63 rpm: slow but not grinding', () {
      final result = at(8);
      expect(result.options.first.cadenceRpm, closeTo(63.16, 0.01));
      expect(result.recommended.gear, const Gear(chainring: 34, cog: 34));
      expect(result.willGrind, isFalse);
    });

    test('flags grinding below 60 rpm and proposes gearing that fixes it', () {
      // 39x28 at 8 km/h is the spec golden case: 45.6 rpm... on this wheel
      // 45.3 rpm.
      final result = gearingForSpeed(
        speedKmh: 8,
        powerW: 150,
        chainrings: const [39, 52],
        cogs: const [11, 28],
        circumferenceMm: circumference,
      );
      expect(result.willGrind, isTrue);
      expect(result.recommended.gear, const Gear(chainring: 39, cog: 28));

      // The proposals must actually reach the comfortable cadence...
      final withCog = Gear(chainring: 39, cog: result.cogForComfort!);
      expect(
        withCog.cadenceRpm(speedKmh: 8, circumferenceMm: circumference),
        greaterThanOrEqualTo(comfortableClimbCadenceRpm),
      );
      final withRing = Gear(chainring: result.chainringForComfort!, cog: 28);
      expect(
        withRing.cadenceRpm(speedKmh: 8, circumferenceMm: circumference),
        greaterThanOrEqualTo(comfortableClimbCadenceRpm),
      );
      // ...and be the mildest change that does: one tooth less would not.
      expect(
        Gear(
          chainring: 39,
          cog: result.cogForComfort! - 1,
        ).cadenceRpm(speedKmh: 8, circumferenceMm: circumference),
        lessThan(comfortableClimbCadenceRpm),
      );
      expect(
        Gear(
          chainring: result.chainringForComfort! + 1,
          cog: 28,
        ).cadenceRpm(speedKmh: 8, circumferenceMm: circumference),
        lessThan(comfortableClimbCadenceRpm),
      );
    });

    test('a crawl never suggests a chainring below one tooth', () {
      final result = gearingForSpeed(
        speedKmh: 0.05,
        powerW: 5,
        chainrings: const [34],
        cogs: const [34],
        circumferenceMm: circumference,
      );
      expect(result.chainringForComfort, 1);
    });
  });

  group('predictClimb', () {
    Explained<ClimbGearing> predict({
      Explained<double>? power,
      bool cogsConfirmed = true,
      double? rollOut,
    }) => predictClimb(
      power:
          power ??
          climbingPowerW(effort: Effort.steady, riderMassKg: 69, ftpWatts: 188),
      riderMassKg: 69,
      gradePercent: 5,
      chainrings: const [34, 50],
      cogs: const [11, 13, 15, 17, 19, 21, 24, 27, 30, 34],
      cogsConfirmed: cogsConfirmed,
      circumference: wheelCircumferenceMm(
        beadSeatDiameterMm: 622,
        tyreWidthMm: 25,
        measuredRollOutMm: rollOut,
      ),
    );

    test('uses rider + default bike mass and solves the reference case', () {
      // 69 + 11 = 80 kg; 188 x 0.8 = 150.4 W up 5%.
      final result = predict();
      expect(result.inputs, contains(const Input(Quantity.totalMassKg, 80.0)));
      expect(result.value.powerW, closeTo(150.4, 1e-9));
      expect(result.value.speedKmh, closeTo(11.59, 0.01));
      expect(result.formula, Formula.climbPowerBalance);
    });

    test('is capped at Estimated even with every input measured', () {
      const measuredPower = Explained<double>(
        value: 150,
        confidence: Confidence.measured,
        formula: Formula.climbPowerBalance,
      );
      expect(
        predict(power: measuredPower, rollOut: 2105).confidence,
        Confidence.estimated,
      );
    });

    test('drops to Rough when the power is a guess', () {
      final result = predict(
        power: climbingPowerW(effort: Effort.steady, riderMassKg: 69),
      );
      expect(result.confidence, Confidence.rough);
      expect(result.improvements, contains(Improvement.doFtpTest));
    });

    test('drops to Rough when the cogs are only estimated', () {
      final result = predict(cogsConfirmed: false);
      expect(result.confidence, Confidence.rough);
      expect(result.improvements, contains(Improvement.confirmCogs));
    });

    test('a heavier bike and kit is slower', () {
      double speed(double bikeKg) => predictClimb(
        power: climbingPowerW(
          effort: Effort.steady,
          riderMassKg: 69,
          ftpWatts: 188,
        ),
        riderMassKg: 69,
        gradePercent: 5,
        chainrings: const [34],
        cogs: const [34],
        cogsConfirmed: true,
        circumference: wheelCircumferenceMm(
          beadSeatDiameterMm: 622,
          tyreWidthMm: 25,
        ),
        bikeAndKitKg: bikeKg,
      ).value.speedKmh;
      expect(speed(15), lessThan(speed(9)));
    });
  });
}
