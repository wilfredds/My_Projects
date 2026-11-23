import 'package:flutter_test/flutter_test.dart';
import 'package:ride_doctor/core/science/confidence.dart';
import 'package:ride_doctor/core/science/explained.dart';
import 'package:ride_doctor/features/calculators/domain/my_numbers.dart';
import 'package:ride_doctor/features/profile/domain/bike.dart';
import 'package:ride_doctor/features/profile/domain/rider_profile.dart';

import '../profile/garage_repository_test.dart' show roadBike;
import '../profile/rider_repository_test.dart' show essentials;

void main() {
  MyNumbers build({RiderProfile profile = essentials, Bike? bike}) =>
      buildMyNumbers(profile: profile, bike: bike, currentYear: 2026);

  group('a phone-only beginner straight out of onboarding', () {
    final numbers = build();

    test('gets an estimated max HR and rough zones from age alone', () {
      // Born 2004 -> 22 -> 208 - 15.4 = 193.
      expect(numbers.ageYears, 22);
      expect(numbers.maxHr.value, 193);
      expect(numbers.maxHr.confidence, Confidence.estimated);
      expect(numbers.hrZones.formula, Formula.percentMaxHrZones);
      expect(numbers.hrZones.confidence, Confidence.rough);
    });

    test('everything that needs more data is absent, not guessed', () {
      expect(numbers.powerZones, isNull);
      expect(numbers.wattsPerKg, isNull);
      expect(numbers.saddleHeightStart, isNull);
      expect(numbers.saddleHeightDifferenceMm, isNull);
      expect(numbers.wheelCircumference, isNull);
      expect(numbers.drivetrain, isNull);
      expect(numbers.canCalculateGearing, isFalse);
    });
  });

  group('heart rate method improves with data', () {
    test('resting HR -> Karvonen', () {
      final numbers = build(profile: essentials.copyWith(restingHrBpm: 55));
      expect(numbers.hrZones.formula, Formula.karvonenZones);
    });

    test('LTHR -> Friel, Measured', () {
      final numbers = build(
        profile: essentials.copyWith(restingHrBpm: 55, lthrBpm: 170),
      );
      expect(numbers.hrZones.formula, Formula.frielLthrZones);
      expect(numbers.hrZones.confidence, Confidence.measured);
    });

    test('measured max HR is used and lifts zone confidence', () {
      final numbers = build(profile: essentials.copyWith(maxHrBpm: 201));
      expect(numbers.maxHr.value, 201);
      expect(numbers.hrZones.confidence, Confidence.estimated);
    });

    test('a resting HR at or above the maximum is ignored, not fatal', () {
      final numbers = build(
        profile: essentials.copyWith(maxHrBpm: 110, restingHrBpm: 115),
      );
      expect(numbers.hrZones.formula, Formula.percentMaxHrZones);
    });
  });

  test('FTP unlocks power zones and W/kg', () {
    final numbers = build(profile: essentials.copyWith(ftpWatts: 180));
    expect(numbers.powerZones!.value, hasLength(7));
    // 180 W / 58.5 kg
    expect(numbers.wattsPerKg!.value, closeTo(3.077, 0.001));
  });

  group('saddle height', () {
    test('inseam alone gives the starting point', () {
      final numbers = build(profile: essentials.copyWith(inseamMm: 760));
      expect(numbers.saddleHeightStart!.value, closeTo(671.08, 0.01));
      expect(numbers.saddleHeightDifferenceMm, isNull);
    });

    test('with a current height, the difference is current minus start', () {
      final numbers = build(
        profile: essentials.copyWith(inseamMm: 760),
        bike: roadBike,
      );
      // 762 - 671.08
      expect(numbers.saddleHeightDifferenceMm, closeTo(90.92, 0.01));
    });

    test('a current height without an inseam gives no difference', () {
      expect(build(bike: roadBike).saddleHeightDifferenceMm, isNull);
    });
  });

  group('wheel and gearing', () {
    test('the reference road bike can calculate gearing', () {
      final numbers = build(bike: roadBike);
      expect(numbers.wheelCircumference!.value, closeTo(2111.15, 0.01));
      expect(numbers.wheelCircumference!.confidence, Confidence.estimated);
      expect(numbers.drivetrain!.chainrings, [34, 50]);
      expect(numbers.canCalculateGearing, isTrue);
    });

    test('a roll-out measurement works even without a tyre size', () {
      final numbers = build(
        bike: const Bike(id: 'b', type: BikeType.road, rollOutMm: 2098),
      );
      expect(numbers.wheelCircumference!.value, 2098);
      expect(numbers.wheelCircumference!.confidence, Confidence.measured);
    });

    test('half a tyre size is not enough', () {
      final numbers = build(
        bike: const Bike(id: 'b', type: BikeType.road, tyreWidthMm: 25),
      );
      expect(numbers.wheelCircumference, isNull);
    });

    test('an empty drivetrain counts as none', () {
      final numbers = build(
        bike: roadBike.copyWith(
          drivetrain: const Drivetrain(
            chainrings: [],
            cogs: [11, 34],
            cogsConfirmed: false,
          ),
        ),
      );
      expect(numbers.drivetrain, isNull);
      expect(numbers.canCalculateGearing, isFalse);
    });
  });
}
